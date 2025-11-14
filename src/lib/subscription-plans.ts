/**
 * @deprecated This file contains legacy pricing (₹999/3mo, ₹1999/year)
 *
 * DO NOT USE THIS FILE FOR NEW CODE!
 *
 * Current pricing is now managed in:
 * - src/contexts/SubscriptionContext.tsx (₹149/month, ₹399/3mo, ₹699/6mo, ₹999/year)
 * - src/app/pricing/page.tsx
 *
 * This file is kept for backwards compatibility only and should be migrated away from.
 *
 * @see src/contexts/SubscriptionContext.tsx
 */

/**
 * Subscription Plans Configuration (DEPRECATED)
 *
 * Defines the available subscription tiers and their features
 */

export interface SubscriptionPlan {
  id: 'free' | 'counseling' | 'premium';
  name: string;
  price: number; // in rupees
  pricePaise: number; // in paise for Razorpay
  duration: 'monthly' | 'seasonal' | 'annual';
  durationMonths: number;
  features: string[];
  badge?: string;
  popular?: boolean;
  color: string;
  limits: {
    savedColleges: number | 'unlimited';
    dailyRecommendations: number | 'unlimited';
    cutoffYears: number | 'all';
    realTimeUpdates: boolean;
    smsAlerts: boolean;
    emailAlerts: boolean;
    advancedAnalytics: boolean;
    hiddenGems: boolean;
    prioritySupport: boolean;
    familySharing: boolean;
    documentManager: boolean;
    customReports: boolean;
  };
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Explorer',
    price: 0,
    pricePaise: 0,
    duration: 'monthly',
    durationMonths: 1,
    color: 'gray',
    features: [
      'Basic college search',
      'View cutoffs (last 3 years)',
      'Save up to 10 colleges',
      '3 recommendations per day',
      'Basic chance calculator',
      'Community support'
    ],
    limits: {
      savedColleges: 10,
      dailyRecommendations: 3,
      cutoffYears: 3,
      realTimeUpdates: false,
      smsAlerts: false,
      emailAlerts: false,
      advancedAnalytics: false,
      hiddenGems: false,
      prioritySupport: false,
      familySharing: false,
      documentManager: false,
      customReports: false
    }
  },
  {
    id: 'counseling',
    name: 'Counseling Season Pass',
    price: 999,
    pricePaise: 99900,
    duration: 'seasonal',
    durationMonths: 3,
    badge: 'Most Popular During Counseling',
    popular: true,
    color: 'blue',
    features: [
      'Everything in Free tier',
      'Live counseling tracker with real-time updates',
      'Unlimited recommendations',
      'Save unlimited colleges',
      'Advanced analytics dashboard',
      'SMS + Email alerts',
      'Priority customer support',
      'Round-wise strategy recommendations',
      'Hidden gem colleges discovery',
      'Early advantage predictions'
    ],
    limits: {
      savedColleges: 'unlimited',
      dailyRecommendations: 'unlimited',
      cutoffYears: 'all',
      realTimeUpdates: true,
      smsAlerts: true,
      emailAlerts: true,
      advancedAnalytics: true,
      hiddenGems: true,
      prioritySupport: true,
      familySharing: false,
      documentManager: false,
      customReports: false
    }
  },
  {
    id: 'premium',
    name: 'Premium Annual',
    price: 1999,
    pricePaise: 199900,
    duration: 'annual',
    durationMonths: 12,
    badge: 'Best Value',
    color: 'purple',
    features: [
      'Everything in Counseling Pass',
      'AI Study Buddy chatbot',
      'College visit planner with maps',
      'Document manager with OCR',
      'Family sharing (up to 3 members)',
      'Custom reports generation',
      'One-on-one career counseling session',
      'NEET preparation tracker',
      'Priority application review',
      'Lifetime cutoff data access'
    ],
    limits: {
      savedColleges: 'unlimited',
      dailyRecommendations: 'unlimited',
      cutoffYears: 'all',
      realTimeUpdates: true,
      smsAlerts: true,
      emailAlerts: true,
      advancedAnalytics: true,
      hiddenGems: true,
      prioritySupport: true,
      familySharing: true,
      documentManager: true,
      customReports: true
    }
  }
];

// =====================================================
// FEATURE GATING
// =====================================================

export type FeatureKey = keyof SubscriptionPlan['limits'];

/**
 * Check if a specific feature is available for a tier
 */
export function hasFeatureAccess(
  tier: 'free' | 'counseling' | 'premium',
  feature: FeatureKey
): boolean {
  const plan = SUBSCRIPTION_PLANS.find(p => p.id === tier);
  if (!plan) return false;

  const limit = plan.limits[feature];

  // Boolean features
  if (typeof limit === 'boolean') return limit;

  // Numeric/unlimited features
  if (limit === 'unlimited' || limit === 'all') return true;
  if (typeof limit === 'number') return limit > 0;

  return false;
}

/**
 * Get the limit value for a feature
 */
export function getFeatureLimit(
  tier: 'free' | 'counseling' | 'premium',
  feature: FeatureKey
): number | 'unlimited' | 'all' | boolean {
  const plan = SUBSCRIPTION_PLANS.find(p => p.id === tier);
  if (!plan) return false;

  return plan.limits[feature];
}

/**
 * Check if user has reached their saved colleges limit
 */
export function canSaveMoreColleges(
  tier: 'free' | 'counseling' | 'premium',
  currentCount: number
): boolean {
  const limit = getFeatureLimit(tier, 'savedColleges');

  if (limit === 'unlimited') return true;
  if (typeof limit === 'number') return currentCount < limit;

  return false;
}

/**
 * Check if user can get more recommendations today
 */
export function canGetMoreRecommendations(
  tier: 'free' | 'counseling' | 'premium',
  todayCount: number
): boolean {
  const limit = getFeatureLimit(tier, 'dailyRecommendations');

  if (limit === 'unlimited') return true;
  if (typeof limit === 'number') return todayCount < limit;

  return false;
}

/**
 * Get plan by ID
 */
export function getPlanById(planId: string): SubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS.find(p => p.id === planId);
}

/**
 * Calculate subscription end date
 */
export function calculateEndDate(
  plan: SubscriptionPlan,
  startDate: Date = new Date()
): Date {
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + plan.durationMonths);
  return endDate;
}

/**
 * Check if subscription is expired
 */
export function isSubscriptionExpired(endDate: string | null): boolean {
  if (!endDate) return true;
  return new Date(endDate) < new Date();
}

/**
 * Get effective tier (considering expiration)
 */
export function getEffectiveTier(
  tier: 'free' | 'counseling' | 'premium',
  endDate: string | null
): 'free' | 'counseling' | 'premium' {
  if (tier === 'free') return 'free';
  if (isSubscriptionExpired(endDate)) return 'free';
  return tier;
}

// =====================================================
// UPGRADE PATHS & PRICING
// =====================================================

export interface UpgradeSuggestion {
  from: 'free' | 'counseling';
  to: 'counseling' | 'premium';
  savings?: number;
  newFeatures: string[];
  ctaText: string;
}

export const UPGRADE_SUGGESTIONS: UpgradeSuggestion[] = [
  {
    from: 'free',
    to: 'counseling',
    newFeatures: [
      'Live real-time counseling tracker',
      'Unlimited recommendations',
      'SMS alerts for seat filling'
    ],
    ctaText: 'Upgrade for ₹999 - Limited Time!'
  },
  {
    from: 'free',
    to: 'premium',
    savings: 999,
    newFeatures: [
      'Everything in Counseling Pass',
      'AI Study Buddy',
      'Family sharing',
      'One-on-one counseling session'
    ],
    ctaText: 'Go Premium - Save ₹1000!'
  },
  {
    from: 'counseling',
    to: 'premium',
    savings: 997,
    newFeatures: [
      'AI Study Buddy for 24/7 help',
      'Share with family (3 members)',
      'Document manager',
      'Career counseling session'
    ],
    ctaText: 'Upgrade to Premium - Just ₹1000 more!'
  }
];

/**
 * Get upgrade suggestion for current tier
 */
export function getUpgradeSuggestion(
  currentTier: 'free' | 'counseling' | 'premium'
): UpgradeSuggestion | null {
  if (currentTier === 'premium') return null;

  return UPGRADE_SUGGESTIONS.find(s => s.from === currentTier && s.to === 'premium') ||
         UPGRADE_SUGGESTIONS.find(s => s.from === currentTier) ||
         null;
}

// =====================================================
// FEATURE COMPARISON DATA
// =====================================================

export interface FeatureComparison {
  feature: string;
  free: boolean | string | number;
  counseling: boolean | string | number;
  premium: boolean | string | number;
  category: 'core' | 'premium' | 'advanced';
}

export const FEATURE_COMPARISON: FeatureComparison[] = [
  // Core Features
  {
    feature: 'College Search',
    free: true,
    counseling: true,
    premium: true,
    category: 'core'
  },
  {
    feature: 'Saved Colleges',
    free: '10',
    counseling: 'Unlimited',
    premium: 'Unlimited',
    category: 'core'
  },
  {
    feature: 'Daily Recommendations',
    free: '3',
    counseling: 'Unlimited',
    premium: 'Unlimited',
    category: 'core'
  },
  {
    feature: 'Cutoff Data Access',
    free: 'Last 3 years',
    counseling: 'All years',
    premium: 'All years + Lifetime',
    category: 'core'
  },
  {
    feature: 'Basic Chance Calculator',
    free: true,
    counseling: true,
    premium: true,
    category: 'core'
  },

  // Premium Features
  {
    feature: 'Live Counseling Tracker',
    free: false,
    counseling: true,
    premium: true,
    category: 'premium'
  },
  {
    feature: 'Real-time Seat Updates',
    free: false,
    counseling: true,
    premium: true,
    category: 'premium'
  },
  {
    feature: 'SMS Alerts',
    free: false,
    counseling: true,
    premium: true,
    category: 'premium'
  },
  {
    feature: 'Email Alerts',
    free: false,
    counseling: true,
    premium: true,
    category: 'premium'
  },
  {
    feature: 'Hidden Gems Discovery',
    free: false,
    counseling: true,
    premium: true,
    category: 'premium'
  },
  {
    feature: 'Advanced Analytics',
    free: false,
    counseling: true,
    premium: true,
    category: 'premium'
  },
  {
    feature: 'Priority Support',
    free: false,
    counseling: true,
    premium: true,
    category: 'premium'
  },

  // Advanced Features
  {
    feature: 'AI Study Buddy',
    free: false,
    counseling: false,
    premium: true,
    category: 'advanced'
  },
  {
    feature: 'College Visit Planner',
    free: false,
    counseling: false,
    premium: true,
    category: 'advanced'
  },
  {
    feature: 'Document Manager',
    free: false,
    counseling: false,
    premium: true,
    category: 'advanced'
  },
  {
    feature: 'Family Sharing',
    free: false,
    counseling: false,
    premium: '3 members',
    category: 'advanced'
  },
  {
    feature: 'Custom Reports',
    free: false,
    counseling: false,
    premium: true,
    category: 'advanced'
  },
  {
    feature: 'Career Counseling Session',
    free: false,
    counseling: false,
    premium: '1 session',
    category: 'advanced'
  }
];

// =====================================================
// REVENUE PROJECTIONS (for internal use)
// =====================================================

export interface RevenueProjection {
  totalUsers: number;
  freeUsers: number;
  counselingUsers: number;
  premiumUsers: number;
  monthlyRevenue: number;
  seasonalRevenue: number;
  annualRevenue: number;
}

export function calculateRevenueProjection(
  totalUsers: number,
  counselingConversionRate: number = 0.05, // 5%
  premiumConversionRate: number = 0.01 // 1%
): RevenueProjection {
  const counselingUsers = Math.floor(totalUsers * counselingConversionRate);
  const premiumUsers = Math.floor(totalUsers * premiumConversionRate);
  const freeUsers = totalUsers - counselingUsers - premiumUsers;

  const counselingPlan = getPlanById('counseling')!;
  const premiumPlan = getPlanById('premium')!;

  const counselingRevenue = counselingUsers * counselingPlan.price;
  const premiumRevenue = premiumUsers * premiumPlan.price;

  // Seasonal revenue (counseling is 3 months)
  const seasonalRevenue = counselingRevenue;

  // Annual revenue calculation
  const annualCounselingRevenue = counselingRevenue * 4; // 4 seasons
  const annualRevenue = annualCounselingRevenue + premiumRevenue;

  // Monthly average
  const monthlyRevenue = annualRevenue / 12;

  return {
    totalUsers,
    freeUsers,
    counselingUsers,
    premiumUsers,
    monthlyRevenue: Math.round(monthlyRevenue),
    seasonalRevenue: Math.round(seasonalRevenue),
    annualRevenue: Math.round(annualRevenue)
  };
}
