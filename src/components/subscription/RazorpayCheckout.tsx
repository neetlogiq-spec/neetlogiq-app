'use client';

import React, { useState, useEffect } from 'react';
import { X, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { SUBSCRIPTION_PLANS } from '@/lib/subscription-plans';
import { useAuth } from '@/contexts/AuthContext';

interface RazorpayCheckoutProps {
  planId: 'counseling' | 'premium';
  onClose: () => void;
  onSuccess: () => void;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

const RazorpayCheckout: React.FC<RazorpayCheckoutProps> = ({
  planId,
  onClose,
  onSuccess
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'creating' | 'processing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);

  // Load Razorpay script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const createOrder = async () => {
    try {
      setStatus('creating');
      setLoading(true);

      const response = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to create order');
      }

      return result;
    } catch (error) {
      console.error('Error creating order:', error);
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to create order');
      setLoading(false);
      return null;
    }
  };

  const verifyPayment = async (paymentDetails: any) => {
    try {
      setStatus('processing');

      const response = await fetch('/api/payment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentDetails)
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Payment verification failed');
      }

      setStatus('success');
      setTimeout(() => {
        onSuccess();
      }, 2000);

    } catch (error) {
      console.error('Error verifying payment:', error);
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Payment verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!user) {
      alert('Please sign in to continue');
      return;
    }

    const orderData = await createOrder();
    if (!orderData) return;

    const options = {
      key: orderData.razorpayKeyId,
      amount: orderData.order.amount,
      currency: orderData.order.currency,
      name: 'NEETLogiq',
      description: `${orderData.subscription.planName} Subscription`,
      order_id: orderData.order.id,
      prefill: {
        name: user.displayName || '',
        email: user.email || '',
      },
      theme: {
        color: '#3B82F6'
      },
      handler: async function (response: any) {
        await verifyPayment({
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature
        });
      },
      modal: {
        ondismiss: function() {
          setLoading(false);
          setStatus('idle');
        }
      }
    };

    const razorpay = new window.Razorpay(options);
    razorpay.open();
  };

  if (!plan) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-8 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Status Display */}
        {status === 'success' ? (
          <div className="text-center py-8">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Payment Successful! 🎉
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Your subscription has been activated. Redirecting...
            </p>
          </div>
        ) : status === 'error' ? (
          <div className="text-center py-8">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Payment Failed
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {errorMessage}
            </p>
            <button
              onClick={() => {
                setStatus('idle');
                setErrorMessage('');
              }}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Subscribe to {plan.name}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Complete your payment to activate premium features
              </p>
            </div>

            {/* Plan Details */}
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-700 dark:to-gray-900 rounded-xl p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <span className="text-gray-700 dark:text-gray-300 font-medium">
                  {plan.name}
                </span>
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                  ₹{plan.price}
                </span>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {plan.durationMonths} months access • Auto-renewal disabled
              </div>
            </div>

            {/* Features Highlight */}
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                What you'll get:
              </h3>
              <ul className="space-y-2">
                {plan.features.slice(0, 4).map((feature, index) => (
                  <li key={index} className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            {/* Payment Button */}
            <button
              onClick={handlePayment}
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  {status === 'creating' ? 'Creating Order...' : 'Processing Payment...'}
                </>
              ) : (
                <>
                  Pay ₹{plan.price} Securely
                </>
              )}
            </button>

            {/* Security Badge */}
            <div className="mt-4 text-center">
              <div className="flex items-center justify-center text-xs text-gray-500 dark:text-gray-400">
                <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                Secured by Razorpay • PCI DSS Compliant
              </div>
            </div>

            {/* Test Mode Notice */}
            {process.env.NODE_ENV === 'development' && (
              <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-xs text-yellow-800 dark:text-yellow-200">
                  <strong>Test Mode:</strong> Use test cards from Razorpay documentation
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default RazorpayCheckout;
