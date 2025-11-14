'use client';

import React, { useState, useEffect } from 'react';
import { TrendingUp, Heart, BarChart3, FileText, Sparkles } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface UsageQuota {
  saved_colleges: {
    current: number;
    limit: number;
    unlimited: boolean;
  };
  daily_recommendations: {
    current: number;
    limit: number;
    unlimited: boolean;
  };
}

interface UsageQuotaDisplayProps {
  compact?: boolean;
  showUpgradePrompt?: boolean;
}

const UsageQuotaDisplay: React.FC<UsageQuotaDisplayProps> = ({
  compact = false,
  showUpgradePrompt = true
}) => {
  const { isDarkMode } = useTheme();
  const { user, subscriptionTier } = useAuth();

  const [usage, setUsage] = useState<UsageQuota>({
    saved_colleges: { current: 0, limit: 10, unlimited: false },
    daily_recommendations: { current: 0, limit: 3, unlimited: false }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadUsageData();
    }
  }, [user, subscriptionTier]);

  const loadUsageData = async () => {
    try {
      setLoading(true);

      // Get saved colleges count
      const { count: savedCount } = await supabase
        .from('favorites')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id);

      // Get daily recommendation count from profile
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('daily_recommendation_count, subscription_tier')
        .eq('user_id', user?.id)
        .single();

      const isPremium = subscriptionTier === 'premium';

      setUsage({
        saved_colleges: {
          current: savedCount || 0,
          limit: isPremium ? 0 : 10,
          unlimited: isPremium
        },
        daily_recommendations: {
          current: profile?.daily_recommendation_count || 0,
          limit: isPremium ? 0 : 3,
          unlimited: isPremium
        }
      });
    } catch (error) {
      console.error('Error loading usage data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getProgressColor = (current: number, limit: number, unlimited: boolean) => {
    if (unlimited) return 'bg-gradient-to-r from-purple-500 to-blue-500';

    const percentage = (current / limit) * 100;

    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-orange-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getProgressPercentage = (current: number, limit: number, unlimited: boolean) => {
    if (unlimited) return 100;
    return Math.min((current / limit) * 100, 100);
  };

  const QuotaBar = ({
    icon: Icon,
    label,
    current,
    limit,
    unlimited
  }: {
    icon: React.ElementType;
    label: string;
    current: number;
    limit: number;
    unlimited: boolean;
  }) => {
    const percentage = getProgressPercentage(current, limit, unlimited);
    const progressColor = getProgressColor(current, limit, unlimited);

    return (
      <div className={compact ? 'mb-2' : 'mb-4'}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center">
            <Icon className={`w-4 h-4 mr-2 ${
              isDarkMode ? 'text-gray-400' : 'text-gray-600'
            }`} />
            <span className={`text-sm font-medium ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>
              {label}
            </span>
          </div>
          <span className={`text-xs font-semibold ${
            unlimited
              ? 'text-purple-500'
              : percentage >= 90
              ? 'text-red-500'
              : isDarkMode
              ? 'text-gray-400'
              : 'text-gray-600'
          }`}>
            {unlimited ? (
              <span className="flex items-center">
                <Sparkles className="w-3 h-3 mr-1" />
                Unlimited
              </span>
            ) : (
              `${current} / ${limit}`
            )}
          </span>
        </div>

        <div className={`w-full ${
          isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
        } rounded-full h-2 overflow-hidden`}>
          <div
            className={`h-full ${progressColor} transition-all duration-500 ease-out`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {!unlimited && percentage >= 80 && showUpgradePrompt && (
          <p className="text-xs text-orange-500 mt-1">
            {percentage >= 100 ? 'Limit reached! ' : 'Almost at limit! '}
            <a href="/pricing" className="underline hover:text-orange-600">
              Upgrade to Premium
            </a> for unlimited access.
          </p>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className={`${
        isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
      } ${compact ? 'p-3' : 'p-6'} rounded-lg border ${
        isDarkMode ? 'border-gray-700' : 'border-gray-200'
      }`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-300 rounded mb-2"></div>
          <div className="h-2 bg-gray-300 rounded mb-4"></div>
          <div className="h-4 bg-gray-300 rounded mb-2"></div>
          <div className="h-2 bg-gray-300 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${
      isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
    } ${compact ? 'p-3' : 'p-6'} rounded-lg border ${
      isDarkMode ? 'border-gray-700' : 'border-gray-200'
    } shadow-sm`}>
      {!compact && (
        <div className="flex items-center mb-4">
          <BarChart3 className="w-5 h-5 mr-2 text-blue-500" />
          <h3 className="text-lg font-bold">Your Usage</h3>
          {subscriptionTier === 'premium' && (
            <span className="ml-auto px-2 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded">
              Premium
            </span>
          )}
        </div>
      )}

      <QuotaBar
        icon={Heart}
        label="Saved Colleges"
        current={usage.saved_colleges.current}
        limit={usage.saved_colleges.limit}
        unlimited={usage.saved_colleges.unlimited}
      />

      <QuotaBar
        icon={TrendingUp}
        label="Daily Recommendations"
        current={usage.daily_recommendations.current}
        limit={usage.daily_recommendations.limit}
        unlimited={usage.daily_recommendations.unlimited}
      />

      {!compact && subscriptionTier === 'free' && showUpgradePrompt && (
        <div className={`mt-4 pt-4 border-t ${
          isDarkMode ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <a
            href="/pricing"
            className="block w-full py-2 px-4 bg-gradient-to-r from-purple-500 to-blue-500 text-white text-center font-semibold rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all"
          >
            Upgrade for Unlimited Access
          </a>
        </div>
      )}
    </div>
  );
};

export default UsageQuotaDisplay;
