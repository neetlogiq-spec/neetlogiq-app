'use client';

import React, { useState, useEffect } from 'react';
import { Clock, Sparkles, X } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface TrialStatus {
  trial_active: boolean;
  trial_used: boolean;
  trial_available?: boolean;
  days_remaining?: number;
  hours_remaining?: number;
  ends_at?: string;
}

const TrialBanner: React.FC = () => {
  const { isDarkMode } = useTheme();
  const { user } = useAuth();

  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadTrialStatus();
    }
  }, [user]);

  const loadTrialStatus = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase.rpc('get_trial_status', {
        p_user_id: user?.id
      });

      if (error) {
        console.error('Error loading trial status:', error);
        return;
      }

      setTrialStatus(data);
    } catch (error) {
      console.error('Error in loadTrialStatus:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !trialStatus || dismissed) {
    return null;
  }

  // Don't show banner if trial is not active
  if (!trialStatus.trial_active) {
    return null;
  }

  const daysRemaining = trialStatus.days_remaining || 0;
  const hoursRemaining = trialStatus.hours_remaining || 0;

  const isExpiringSoon = daysRemaining === 0;

  return (
    <div className={`relative ${
      isExpiringSoon
        ? 'bg-gradient-to-r from-orange-500 to-red-500'
        : 'bg-gradient-to-r from-purple-500 to-blue-500'
    } text-white p-4 shadow-lg`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center flex-1">
          {isExpiringSoon ? (
            <Clock className="w-6 h-6 mr-3 animate-pulse" />
          ) : (
            <Sparkles className="w-6 h-6 mr-3" />
          )}
          <div>
            <div className="font-bold text-lg">
              {isExpiringSoon ? (
                <>⚠️ Trial Ending Soon!</>
              ) : (
                <>🎉 Premium Trial Active</>
              )}
            </div>
            <div className="text-sm opacity-90">
              {isExpiringSoon ? (
                <>
                  Only {hoursRemaining} hours left! Upgrade now to keep your unlimited access.
                </>
              ) : (
                <>
                  {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining of unlimited Premium features
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/pricing"
            className={`px-6 py-2 ${
              isExpiringSoon
                ? 'bg-white text-red-600 hover:bg-gray-100'
                : 'bg-white text-purple-600 hover:bg-gray-100'
            } font-semibold rounded-lg transition-all shadow-md`}
          >
            {isExpiringSoon ? 'Upgrade Now' : 'View Plans'}
          </a>

          <button
            onClick={() => setDismissed(true)}
            className="p-2 hover:bg-white/20 rounded-lg transition-all"
            aria-label="Dismiss banner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrialBanner;
