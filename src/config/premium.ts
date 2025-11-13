/**
 * Premium Subscription Configuration
 * Pricing tiers, features, and Razorpay plans
 */

export interface PricingPlan {
  id: string;
  name: string;
  displayName: string;
  description: string;
  price: {
    monthly: number;
    quarterly: number;
    halfYearly: number;
    yearly: number;
  };
  razorpayPlanId: {
    monthly: string;
    quarterly: string;
    halfYearly: string;
    yearly: string;
  };
  features: string[];
  limits: {
    collegeComparisons: number | 'unlimited';
    smartPredictions: number | 'unlimited';
    trendAnalysis: boolean;
    counsellingDocuments: number | 'unlimited';
    exportData: number | 'unlimited';
    prioritySupport: boolean;
    advancedFilters: boolean;
    rankPredictor: boolean;
  };
  popular?: boolean;
  color: string;
}

export const PRICING_PLANS: Record<string, PricingPlan> = {
  free: {
    id: 'free',
    name: 'free',
    displayName: 'Free',
    description: 'Perfect for exploring options',
    price: {
      monthly: 0,
      quarterly: 0,
      halfYearly: 0,
      yearly: 0
    },
    razorpayPlanId: {
      monthly: '',
      quarterly: '',
      halfYearly: '',
      yearly: ''
    },
    features: [
      '3 college comparisons/month',
      '5 AI predictions/month',
      'Basic college search',
      '2 document downloads/month',
      'Community support'
    ],
    limits: {
      collegeComparisons: 3,
      smartPredictions: 5,
      trendAnalysis: false,
      counsellingDocuments: 2,
      exportData: 0,
      prioritySupport: false,
      advancedFilters: false,
      rankPredictor: false
    },
    color: 'from-gray-500 to-gray-600'
  },
  premium: {
    id: 'premium',
    name: 'premium',
    displayName: 'Premium',
    description: 'Unlimited access to everything',
    price: {
      monthly: 149,      // ₹149/month
      quarterly: 399,    // ₹133/month - 11% savings
      halfYearly: 699,   // ₹117/month - 21% savings
      yearly: 999        // ₹83/month - 44% savings
    },
    razorpayPlanId: {
      monthly: 'plan_premium_monthly',
      quarterly: 'plan_premium_quarterly',
      halfYearly: 'plan_premium_halfyearly',
      yearly: 'plan_premium_yearly'
    },
    features: [
      'Unlimited college comparisons',
      'Unlimited AI predictions',
      'Full trend analysis access',
      'Unlimited document downloads',
      'All advanced filters',
      'Unlimited data exports',
      'Priority phone + email support',
      'Advanced rank predictor',
      'Early access to new features',
      'Personalized counselling tips'
    ],
    limits: {
      collegeComparisons: 'unlimited',
      smartPredictions: 'unlimited',
      trendAnalysis: true,
      counsellingDocuments: 'unlimited',
      exportData: 'unlimited',
      prioritySupport: true,
      advancedFilters: true,
      rankPredictor: true
    },
    popular: true,
    color: 'from-purple-500 to-pink-500'
  }
};

export const FEATURE_KEYS = {
  COLLEGE_COMPARISONS: 'college_comparisons',
  SMART_PREDICTIONS: 'smart_predictions',
  TREND_ANALYSIS: 'trend_analysis',
  COUNSELLING_DOCUMENTS: 'counselling_documents',
  EXPORT_DATA: 'export_data',
  PRIORITY_SUPPORT: 'priority_support',
  ADVANCED_FILTERS: 'advanced_filters',
  RANK_PREDICTOR: 'rank_predictor'
} as const;

export type FeatureKey = typeof FEATURE_KEYS[keyof typeof FEATURE_KEYS];

export const RAZORPAY_CONFIG = {
  keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '',
  keySecret: process.env.RAZORPAY_KEY_SECRET || '',
  currency: 'INR',
  companyName: 'NEET Advisor',
  companyLogo: '/logo.png',
  theme: {
    color: '#8b5cf6'
  }
};
