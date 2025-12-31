'use client';

import { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { PRICING_PLANS, FeatureKey } from '@/config/premium';
<<<<<<< Updated upstream

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
=======
import { useAuth } from './AuthContext';
>>>>>>> Stashed changes

interface PremiumContextType {
  isPremium: boolean;
  subscriptionTier: string;
  subscriptionEndDate: string | null;
  dailyRecommendationsUsed: number;
  dailyRecommendationsLimit: number;
  canGetRecommendations: boolean;
  isLoading: boolean;
  error: string | null;
  refreshSubscription: () => Promise<void>;
  hasFeatureAccess: (feature: FeatureKey) => boolean;
  canUseFeature: (feature: FeatureKey) => Promise<boolean>;
  getFeatureLimit: (feature: FeatureKey) => number | 'unlimited' | boolean;
  getFeatureUsage: (feature: FeatureKey) => number;
  incrementFeatureUsage: (feature: FeatureKey) => Promise<void>;
  currentPlan: string;
  loading: boolean;
}

const PremiumContext = createContext<PremiumContextType | undefined>(undefined);

export function PremiumProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [subscriptionTier, setSubscriptionTier] = useState<string>('free');
  const [subscriptionEndDate, setSubscriptionEndDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recommendationCount, setRecommendationCount] = useState(0);

  const fetchSubscription = useCallback(async () => {
    if (!user) {
      setSubscriptionTier('free');
      setSubscriptionEndDate(null);
      setRecommendationCount(0);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('user_profiles')
        .select('subscription_tier, subscription_end_date, daily_recommendation_count')
        .eq('user_id', user.uid)
        .single();

      if (fetchError) throw fetchError;

<<<<<<< Updated upstream
      // Fetch active subscription
      const { data: subscriptionData, error: subError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(); // Use maybeSingle() instead of single() to handle no results gracefully

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
=======
      if (data) {
        console.log('💳 PremiumContext: Data loaded:', {
          tier: data.subscription_tier,
          endDate: data.subscription_end_date
>>>>>>> Stashed changes
        });
        setSubscriptionTier(data.subscription_tier || 'free');
        setSubscriptionEndDate(data.subscription_end_date);
        setRecommendationCount(data.daily_recommendation_count || 0);
      }
    } catch (err: any) {
      console.error('Error fetching subscription:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Helper to normalize feature keys (snake_case to camelCase)
  // because config/premium.ts uses camelCase for names in PricingPlan.limits
  const normalizeFeatureKey = (feature: string): string => {
    // If it's already camelCase (no underscores), return as is
    if (!feature.includes('_')) return feature;

    // Convert snake_case to camelCase (e.g., trend_analysis -> trendAnalysis)
    return feature.toLowerCase().replace(/_([a-z])/g, (g) => g[1].toUpperCase());
  };

  const hasFeatureAccess = useCallback((feature: FeatureKey): boolean => {
    const plan = PRICING_PLANS[subscriptionTier] || PRICING_PLANS.free;
    const normalizedKey = normalizeFeatureKey(feature) as keyof typeof plan.limits;
    const limit = plan.limits[normalizedKey];
    
    if (typeof limit === 'boolean') return limit;
    if (limit === 'unlimited') return true;
    if (typeof limit === 'number') return true; 
    
    return false;
  }, [subscriptionTier]);

  const getFeatureLimit = useCallback((feature: FeatureKey): number | 'unlimited' | boolean => {
    const plan = PRICING_PLANS[subscriptionTier] || PRICING_PLANS.free;
    const normalizedKey = normalizeFeatureKey(feature) as keyof typeof plan.limits;
    return plan.limits[normalizedKey];
  }, [subscriptionTier]);

  const getFeatureUsage = useCallback((feature: FeatureKey): number => {
    if (feature === 'smart_predictions') {
      return recommendationCount;
    }
    // Placeholder for other usages
    return 0;
  }, [recommendationCount]);

  const canUseFeature = useCallback(async (feature: FeatureKey): Promise<boolean> => {
    const limit = getFeatureLimit(feature);
    const usage = getFeatureUsage(feature);

    if (typeof limit === 'boolean') return limit;
    if (limit === 'unlimited') return true;
    if (typeof limit === 'number') return usage < limit;

    return false;
  }, [getFeatureLimit, getFeatureUsage]);

  const incrementFeatureUsage = useCallback(async (feature: FeatureKey) => {
    if (!user) return;

    if (feature === 'smart_predictions') {
      try {
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({ 
            daily_recommendation_count: recommendationCount + 1,
            last_recommendation_at: new Date().toISOString()
          })
          .eq('user_id', user.uid);

        if (updateError) throw updateError;
        setRecommendationCount(prev => prev + 1);
      } catch (err) {
        console.error('Error incrementing recommendation count:', err);
      }
    }
    // Handle other features here if needed
  }, [user, recommendationCount]);

  const value: PremiumContextType = {
    isPremium: subscriptionTier !== 'free',
    subscriptionTier,
    subscriptionEndDate,
    dailyRecommendationsUsed: recommendationCount,
    dailyRecommendationsLimit: (PRICING_PLANS[subscriptionTier]?.limits.smartPredictions as number) || 5,
    canGetRecommendations: subscriptionTier !== 'free' || recommendationCount < 5,
    isLoading: loading,
    loading,
    error,
    refreshSubscription: fetchSubscription,
    hasFeatureAccess,
    canUseFeature,
    getFeatureLimit,
    getFeatureUsage,
    incrementFeatureUsage,
    currentPlan: subscriptionTier
  };

  return (
    <PremiumContext.Provider value={value}>
      {children}
    </PremiumContext.Provider>
  );
}

export function usePremium() {
  const context = useContext(PremiumContext);
  if (context === undefined) {
    throw new Error('usePremium must be used within a PremiumProvider');
  }
  return context;
}
