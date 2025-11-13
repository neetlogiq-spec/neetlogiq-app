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
    yearly: number;
  };
  razorpayPlanId: {
    monthly: string;
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
      yearly: 0
    },
    razorpayPlanId: {
      monthly: '',
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
  basic: {
    id: 'basic',
    name: 'basic',
    displayName: 'Basic',
    description: 'Great for serious aspirants',
    price: {
      monthly: 299,
      yearly: 2999  // ~₹250/month
    },
    razorpayPlanId: {
      monthly: 'plan_basic_monthly',
      yearly: 'plan_basic_yearly'
    },
    features: [
      '20 college comparisons/month',
      '50 AI predictions/month',
      'Historical trend analysis',
      '20 document downloads/month',
      'Advanced search filters',
      'Export data (10/month)',
      'Email support'
    ],
    limits: {
      collegeComparisons: 20,
      smartPredictions: 50,
      trendAnalysis: true,
      counsellingDocuments: 20,
      exportData: 10,
      prioritySupport: false,
      advancedFilters: true,
      rankPredictor: true
    },
    color: 'from-blue-500 to-cyan-500'
  },
  pro: {
    id: 'pro',
    name: 'pro',
    displayName: 'Pro',
    description: 'For power users who need more',
    price: {
      monthly: 599,
      yearly: 5999  // ~₹500/month
    },
    razorpayPlanId: {
      monthly: 'plan_pro_monthly',
      yearly: 'plan_pro_yearly'
    },
    features: [
      '100 college comparisons/month',
      '200 AI predictions/month',
      'Full trend analysis access',
      '100 document downloads/month',
      'All advanced filters',
      'Export data (50/month)',
      'Priority email support',
      'Advanced rank predictor'
    ],
    limits: {
      collegeComparisons: 100,
      smartPredictions: 200,
      trendAnalysis: true,
      counsellingDocuments: 100,
      exportData: 50,
      prioritySupport: true,
      advancedFilters: true,
      rankPredictor: true
    },
    popular: true,
    color: 'from-purple-500 to-pink-500'
  },
  premium: {
    id: 'premium',
    name: 'premium',
    displayName: 'Premium',
    description: 'Unlimited access to everything',
    price: {
      monthly: 999,
      yearly: 9999  // ~₹833/month
    },
    razorpayPlanId: {
      monthly: 'plan_premium_monthly',
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
    color: 'from-orange-500 to-red-500'
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
