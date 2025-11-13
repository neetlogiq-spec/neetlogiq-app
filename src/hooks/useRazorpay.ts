/**
 * Razorpay Payment Hook
 * Handles payment checkout flow
 */

'use client';

import { useState } from 'react';
import { usePremium } from '@/contexts/PremiumContext';
import { RAZORPAY_CONFIG } from '@/config/premium';

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface PaymentOptions {
  planId: string;
  billingCycle: 'monthly' | 'quarterly' | 'halfYearly' | 'yearly';
  userId: string;
  userEmail: string;
  userName: string;
}

export const useRazorpay = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { refreshSubscription } = usePremium();

  const initializePayment = async (options: PaymentOptions) => {
    try {
      setLoading(true);
      setError(null);

      // Create order
      const orderResponse = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options)
      });

      const orderData = await orderResponse.json();

      if (!orderData.success) {
        throw new Error(orderData.error || 'Failed to create order');
      }

      // Load Razorpay script if not already loaded
      if (!window.Razorpay) {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        document.body.appendChild(script);
        await new Promise((resolve) => {
          script.onload = resolve;
        });
      }

      // Configure Razorpay checkout
      const rzpOptions = {
        key: orderData.order.keyId,
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        name: RAZORPAY_CONFIG.companyName,
        description: `${orderData.order.planName} Subscription`,
        image: RAZORPAY_CONFIG.companyLogo,
        order_id: orderData.order.id,
        prefill: {
          name: options.userName,
          email: options.userEmail
        },
        theme: {
          color: RAZORPAY_CONFIG.theme.color
        },
        handler: async (response: any) => {
          // Payment successful, verify on backend
          try {
            const verifyResponse = await fetch('/api/payments/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                planId: options.planId,
                billingCycle: options.billingCycle,
                userId: options.userId,
                amount: orderData.order.amount
              })
            });

            const verifyData = await verifyResponse.json();

            if (verifyData.success) {
              // Refresh subscription state
              await refreshSubscription();

              // Show success message
              alert('Payment successful! Your premium subscription is now active.');
              window.location.href = '/dashboard';
            } else {
              throw new Error(verifyData.error || 'Payment verification failed');
            }
          } catch (err) {
            console.error('Payment verification error:', err);
            setError(err instanceof Error ? err.message : 'Payment verification failed');
          } finally {
            setLoading(false);
          }
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
          }
        }
      };

      // Open Razorpay checkout
      const razorpayInstance = new window.Razorpay(rzpOptions);
      razorpayInstance.open();
    } catch (err) {
      console.error('Payment initialization error:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize payment');
      setLoading(false);
    }
  };

  return {
    initializePayment,
    loading,
    error
  };
};
