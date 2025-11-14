/**
 * Subscription Gift Manager (Admin)
 *
 * Allows admins to manually activate/gift subscriptions to users
 */

'use client';

import React, { useState } from 'react';
import { Gift, Search, Calendar, Mail, Check, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function SubscriptionGiftManager() {
  const [userEmail, setUserEmail] = useState('');
  const [planType, setPlanType] = useState<'free' | 'premium'>('premium');
  const [durationType, setDurationType] = useState<'preset' | 'custom'>('preset');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'quarterly' | 'halfYearly' | 'yearly'>('yearly');
  const [customDays, setCustomDays] = useState(365);
  const [reason, setReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const presetDurations = {
    'monthly': { days: 30, label: '1 Month', price: '₹149' },
    'quarterly': { days: 90, label: '3 Months', price: '₹399' },
    'halfYearly': { days: 180, label: '6 Months', price: '₹699' },
    'yearly': { days: 365, label: '1 Year', price: '₹999' }
  };

  const handleGiftSubscription = async () => {
    if (!userEmail.trim()) {
      alert('Please enter user email');
      return;
    }

    setProcessing(true);
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/admin/subscriptions/gift', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          userEmail: userEmail.trim(),
          planType,
          billingCycle: durationType === 'preset' ? billingCycle : undefined,
          customDuration: durationType === 'custom' ? customDays : undefined,
          reason: reason.trim() || 'Admin gift'
        })
      });

      const data = await response.json();

      if (response.ok) {
        setResult({
          success: true,
          message: data.message
        });
        // Reset form
        setUserEmail('');
        setReason('');
      } else {
        setResult({
          success: false,
          message: data.error || 'Failed to gift subscription'
        });
      }
    } catch (error) {
      console.error('Error gifting subscription:', error);
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred'
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
          <Gift className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gift Subscription</h2>
          <p className="mt-1 text-gray-600">
            Manually activate or gift premium access to users
          </p>
        </div>
      </div>

      {/* Result Message */}
      {result && (
        <div className={`p-4 rounded-lg border-2 flex items-start gap-3 ${
          result.success
            ? 'bg-green-50 border-green-200'
            : 'bg-red-50 border-red-200'
        }`}>
          {result.success ? (
            <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          )}
          <div>
            <p className={`font-medium ${
              result.success ? 'text-green-800' : 'text-red-800'
            }`}>
              {result.success ? 'Success!' : 'Error'}
            </p>
            <p className={`text-sm ${
              result.success ? 'text-green-700' : 'text-red-700'
            }`}>
              {result.message}
            </p>
          </div>
        </div>
      )}

      {/* Gift Form */}
      <div className="bg-white border-2 border-gray-200 rounded-xl p-6 space-y-6">
        {/* User Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            User Email *
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Plan Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Plan Type *
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setPlanType('free')}
              className={`p-4 rounded-lg border-2 transition-all ${
                planType === 'free'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-semibold text-gray-900">Free</div>
              <div className="text-sm text-gray-600">Basic features</div>
            </button>
            <button
              onClick={() => setPlanType('premium')}
              className={`p-4 rounded-lg border-2 transition-all ${
                planType === 'premium'
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-semibold text-gray-900">Premium</div>
              <div className="text-sm text-gray-600">All features</div>
            </button>
          </div>
        </div>

        {/* Duration Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Duration Type *
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setDurationType('preset')}
              className={`p-4 rounded-lg border-2 transition-all ${
                durationType === 'preset'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Calendar className="w-5 h-5 mx-auto mb-1 text-gray-600" />
              <div className="font-semibold text-gray-900">Preset</div>
              <div className="text-xs text-gray-600">Standard plans</div>
            </button>
            <button
              onClick={() => setDurationType('custom')}
              className={`p-4 rounded-lg border-2 transition-all ${
                durationType === 'custom'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Search className="w-5 h-5 mx-auto mb-1 text-gray-600" />
              <div className="font-semibold text-gray-900">Custom</div>
              <div className="text-xs text-gray-600">Any duration</div>
            </button>
          </div>
        </div>

        {/* Preset Duration Options */}
        {durationType === 'preset' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Select Duration *
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(Object.entries(presetDurations) as [keyof typeof presetDurations, typeof presetDurations[keyof typeof presetDurations]][]).map(([key, value]) => (
                <button
                  key={key}
                  onClick={() => setBillingCycle(key)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    billingCycle === key
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold text-gray-900">{value.label}</div>
                  <div className="text-sm text-gray-600">{value.days} days</div>
                  <div className="text-xs text-purple-600 font-medium mt-1">
                    Worth {value.price}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Custom Duration */}
        {durationType === 'custom' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Custom Duration (Days) *
            </label>
            <input
              type="number"
              min="1"
              max="3650"
              value={customDays}
              onChange={(e) => setCustomDays(parseInt(e.target.value) || 1)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-1 text-sm text-gray-500">
              Enter number of days (1-3650)
            </p>
          </div>
        )}

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reason (Optional)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why are you gifting this subscription? (e.g., Contest winner, Special case, etc.)"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
          />
        </div>

        {/* Summary */}
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-2">Summary</h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Plan:</span>
              <span className="font-medium text-gray-900">{planType === 'premium' ? 'Premium' : 'Free'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Duration:</span>
              <span className="font-medium text-gray-900">
                {durationType === 'preset'
                  ? presetDurations[billingCycle].label
                  : `${customDays} days`
                }
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Value:</span>
              <span className="font-medium text-purple-600">
                {durationType === 'preset' ? presetDurations[billingCycle].price : 'Custom'}
              </span>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleGiftSubscription}
          disabled={processing || !userEmail.trim()}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {processing ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Gift className="w-5 h-5" />
              Gift Subscription
            </>
          )}
        </button>
      </div>

      {/* Info Box */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">📌 Important Notes:</h4>
        <ul className="space-y-1 text-sm text-blue-800">
          <li>• User must already have an account with the specified email</li>
          <li>• Any existing active subscription will be cancelled</li>
          <li>• Gifted subscriptions are marked as non-renewable</li>
          <li>• User will receive an in-app notification</li>
          <li>• This action is tracked in payment history</li>
        </ul>
      </div>
    </div>
  );
}
