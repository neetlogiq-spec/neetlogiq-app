'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, X, Lock, Eye, Database, Check } from 'lucide-react';

const PrivacyNotice: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has already acknowledged the privacy notice
    const hasAcknowledged = localStorage.getItem('neetlogiq-privacy-acknowledged');
    if (!hasAcknowledged) {
      // Show notice after a brief delay
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAcknowledge = () => {
    localStorage.setItem('neetlogiq-privacy-acknowledged', 'true');
    setIsVisible(false);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    // Show again in 24 hours if not acknowledged
    setTimeout(() => {
      const hasAcknowledged = localStorage.getItem('neetlogiq-privacy-acknowledged');
      if (!hasAcknowledged) {
        setIsVisible(true);
      }
    }, 24 * 60 * 60 * 1000); // 24 hours
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 50 }}
          className="fixed bottom-4 right-4 max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 z-50"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center">
              <Shield className="w-6 h-6 text-green-500 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Privacy First 🔒
              </h3>
            </div>
            <button
              onClick={handleDismiss}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-3 mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <strong>NeetLogIQ respects your privacy.</strong> Here's how we protect you:
            </p>

            <div className="space-y-2">
              <div className="flex items-start">
                <Check className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  <strong>Google Sign-in Only:</strong> Secure authentication without storing passwords
                </span>
              </div>
              <div className="flex items-start">
                <Check className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  <strong>Local Storage:</strong> Your preferences stay on your device
                </span>
              </div>
              <div className="flex items-start">
                <Check className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  <strong>No Data Mining:</strong> We don't collect or sell personal information
                </span>
              </div>
              <div className="flex items-start">
                <Check className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  <strong>Minimal Analytics:</strong> Only essential usage data, anonymized
                </span>
              </div>
            </div>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 mb-4">
            <div className="flex items-center">
              <Eye className="w-4 h-4 text-green-600 dark:text-green-400 mr-2" />
              <span className="text-sm font-medium text-green-800 dark:text-green-300">
                Your privacy is our commitment, not just a policy.
              </span>
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={handleAcknowledge}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Got it, thanks! ✓
            </button>
            <button
              onClick={() => window.open('/privacy', '_blank')}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium py-2 px-4 rounded-lg border border-blue-600 dark:border-blue-400 transition-colors"
            >
              Learn More
            </button>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-500 mt-3 text-center">
            Questions? Email us at privacy@neetlogiq.com
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PrivacyNotice;