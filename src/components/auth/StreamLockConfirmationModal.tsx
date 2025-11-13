/**
 * Stream Lock Confirmation Modal
 *
 * Warns users that stream selection is permanent and cannot be changed.
 * Requires explicit confirmation before locking the stream.
 */

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Lock,
  Check,
  X,
  Mail
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface StreamLockConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  streamName: string;
  streamDescription: string;
  isLoading?: boolean;
}

const StreamLockConfirmationModal: React.FC<StreamLockConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  streamName,
  streamDescription,
  isLoading = false
}) => {
  const { isDarkMode } = useTheme();
  const [acknowledged, setAcknowledged] = useState(false);

  const handleConfirm = () => {
    if (!acknowledged) return;
    onConfirm();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={!isLoading ? onClose : undefined}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={`relative w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden ${
              isDarkMode ? 'bg-gray-900 border border-gray-700' : 'bg-white border border-gray-200'
            }`}
          >
            {/* Header with Warning */}
            <div className={`px-6 py-4 border-b ${isDarkMode ? 'border-gray-700 bg-orange-900/20' : 'border-orange-200 bg-orange-50'}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${isDarkMode ? 'bg-orange-900/50' : 'bg-orange-100'}`}>
                  <AlertTriangle className={`w-6 h-6 ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`} />
                </div>
                <div>
                  <h2 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Confirm Stream Selection
                  </h2>
                  <p className={`text-sm ${isDarkMode ? 'text-orange-300' : 'text-orange-700'}`}>
                    Important: This action is permanent
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Selected Stream Display */}
              <div className={`p-4 rounded-lg border-2 ${
                isDarkMode ? 'bg-blue-900/20 border-blue-700' : 'bg-blue-50 border-blue-200'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <Lock className={`w-4 h-4 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`}>
                    You have selected:
                  </span>
                </div>
                <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {streamName}
                </h3>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {streamDescription}
                </p>
              </div>

              {/* Warning Message */}
              <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <X className={`w-5 h-5 mt-0.5 flex-shrink-0 ${isDarkMode ? 'text-red-400' : 'text-red-500'}`} />
                    <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      <strong>You will NOT be able to change this selection yourself</strong> after confirming.
                    </p>
                  </div>

                  <div className="flex items-start gap-2">
                    <Lock className={`w-5 h-5 mt-0.5 flex-shrink-0 ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`} />
                    <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Your stream will be <strong>locked permanently</strong> to ensure data consistency.
                    </p>
                  </div>

                  <div className="flex items-start gap-2">
                    <Mail className={`w-5 h-5 mt-0.5 flex-shrink-0 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                    <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      If you need to change it later, you will have to <strong>email our support team</strong> with your request.
                    </p>
                  </div>
                </div>
              </div>

              {/* Acknowledgment Checkbox */}
              <div className={`p-4 rounded-lg border-2 ${
                acknowledged
                  ? isDarkMode ? 'bg-green-900/20 border-green-700' : 'bg-green-50 border-green-200'
                  : isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-300'
              }`}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      checked={acknowledged}
                      onChange={(e) => setAcknowledged(e.target.checked)}
                      disabled={isLoading}
                      className="peer sr-only"
                    />
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                      acknowledged
                        ? 'bg-green-600 border-green-600'
                        : isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-white'
                    }`}>
                      {acknowledged && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </div>
                  <span className={`text-sm font-medium ${
                    acknowledged
                      ? isDarkMode ? 'text-green-300' : 'text-green-700'
                      : isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    I understand that this stream selection is permanent and cannot be changed later without contacting support.
                  </span>
                </label>
              </div>
            </div>

            {/* Footer */}
            <div className={`px-6 py-4 border-t ${isDarkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  disabled={isLoading}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                    isDarkMode
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50'
                  }`}
                >
                  Go Back
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={!acknowledged || isLoading}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                    !acknowledged || isLoading
                      ? 'opacity-50 cursor-not-allowed'
                      : ''
                  } ${
                    isDarkMode
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Confirming...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      Confirm and Lock
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default StreamLockConfirmationModal;
