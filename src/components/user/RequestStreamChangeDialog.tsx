/**
 * Request Stream Change Dialog
 *
 * Allows users with locked streams to request a stream change from support
 */

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Mail, X, Send, GraduationCap, Stethoscope, Activity } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useStream } from '@/contexts/StreamContext';
import type { StreamType } from '@/contexts/StreamContext';

interface RequestStreamChangeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentStream: StreamType;
}

const RequestStreamChangeDialog: React.FC<RequestStreamChangeDialogProps> = ({
  isOpen,
  onClose,
  currentStream
}) => {
  const { isDarkMode } = useTheme();
  const { requestStreamChange } = useStream();
  const [selectedStream, setSelectedStream] = useState<StreamType | null>(null);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const streams = [
    {
      id: 'UG' as const,
      name: 'Undergraduate',
      description: 'MBBS, BDS courses',
      icon: GraduationCap
    },
    {
      id: 'PG_MEDICAL' as const,
      name: 'Postgraduate Medical',
      description: 'MD, MS, DNB courses',
      icon: Stethoscope
    },
    {
      id: 'PG_DENTAL' as const,
      name: 'Postgraduate Dental',
      description: 'MDS courses',
      icon: Activity
    }
  ];

  const availableStreams = streams.filter(s => s.id !== currentStream);

  const handleSubmit = async () => {
    if (!selectedStream || !reason.trim()) {
      alert('Please select a stream and provide a reason');
      return;
    }

    if (reason.trim().length < 10) {
      alert('Please provide a detailed reason (at least 10 characters)');
      return;
    }

    setIsSubmitting(true);
    try {
      await requestStreamChange(selectedStream, reason.trim());
      setSubmitted(true);
    } catch (error) {
      console.error('Error submitting request:', error);
      alert(error instanceof Error ? error.message : 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedStream(null);
    setReason('');
    setSubmitted(false);
    onClose();
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
            onClick={!isSubmitting ? handleClose : undefined}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={`relative w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden ${
              isDarkMode ? 'bg-gray-900 border border-gray-700' : 'bg-white border border-gray-200'
            }`}
          >
            {submitted ? (
              /* Success State */
              <div className="p-8 text-center">
                <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${
                  isDarkMode ? 'bg-green-900/30' : 'bg-green-100'
                }`}>
                  <Send className={`w-8 h-8 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} />
                </div>
                <h2 className={`text-2xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Request Submitted!
                </h2>
                <p className={`text-lg mb-6 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Your stream change request has been sent to our support team.
                </p>
                <div className={`p-4 rounded-lg mb-6 ${isDarkMode ? 'bg-blue-900/20 border border-blue-700' : 'bg-blue-50 border border-blue-200'}`}>
                  <p className={`text-sm ${isDarkMode ? 'text-blue-300' : 'text-blue-800'}`}>
                    <Mail className="w-4 h-4 inline mr-2" />
                    We'll review your request and get back to you via email within 2-3 business days.
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className={`px-6 py-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        Request Stream Change
                      </h2>
                      <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Submit a request to change your locked stream
                      </p>
                    </div>
                    <button
                      onClick={handleClose}
                      disabled={isSubmitting}
                      className={`p-2 rounded-lg transition-colors ${
                        isDarkMode
                          ? 'text-gray-400 hover:text-white hover:bg-gray-800'
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                  {/* Current Stream */}
                  <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Lock className={`w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                      <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Current Stream (Locked):
                      </span>
                    </div>
                    <div className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {streams.find(s => s.id === currentStream)?.name}
                    </div>
                  </div>

                  {/* Select New Stream */}
                  <div>
                    <label className={`block text-sm font-medium mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Select Requested Stream *
                    </label>
                    <div className="grid gap-3 md:grid-cols-2">
                      {availableStreams.map((stream) => {
                        const Icon = stream.icon;
                        const isSelected = selectedStream === stream.id;

                        return (
                          <button
                            key={stream.id}
                            onClick={() => setSelectedStream(stream.id)}
                            disabled={isSubmitting}
                            className={`p-4 rounded-lg border-2 transition-all text-left ${
                              isSelected
                                ? isDarkMode
                                  ? 'bg-blue-900/30 border-blue-600'
                                  : 'bg-blue-50 border-blue-500'
                                : isDarkMode
                                ? 'bg-gray-800 border-gray-700 hover:border-gray-600'
                                : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <Icon className={`w-5 h-5 mt-0.5 ${
                                isSelected
                                  ? 'text-blue-500'
                                  : isDarkMode ? 'text-gray-400' : 'text-gray-600'
                              }`} />
                              <div>
                                <div className={`font-semibold ${
                                  isSelected
                                    ? isDarkMode ? 'text-blue-300' : 'text-blue-700'
                                    : isDarkMode ? 'text-white' : 'text-gray-900'
                                }`}>
                                  {stream.name}
                                </div>
                                <div className={`text-xs ${
                                  isSelected
                                    ? isDarkMode ? 'text-blue-400' : 'text-blue-600'
                                    : isDarkMode ? 'text-gray-500' : 'text-gray-600'
                                }`}>
                                  {stream.description}
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Reason */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Reason for Change * (minimum 10 characters)
                    </label>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      disabled={isSubmitting}
                      placeholder="Please explain why you need to change your stream selection..."
                      className={`w-full px-4 py-3 rounded-lg border resize-none ${
                        isDarkMode
                          ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                      }`}
                      rows={5}
                    />
                    <div className={`mt-1 text-xs ${
                      reason.length >= 10
                        ? isDarkMode ? 'text-green-400' : 'text-green-600'
                        : isDarkMode ? 'text-gray-500' : 'text-gray-500'
                    }`}>
                      {reason.length} / 10 characters minimum
                    </div>
                  </div>

                  {/* Info */}
                  <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-blue-900/20 border border-blue-700' : 'bg-blue-50 border border-blue-200'}`}>
                    <p className={`text-sm ${isDarkMode ? 'text-blue-300' : 'text-blue-800'}`}>
                      <strong>📧 What happens next?</strong> Our support team will review your request and respond via email within 2-3 business days. Please ensure your email is correct in your profile.
                    </p>
                  </div>
                </div>

                {/* Footer */}
                <div className={`px-6 py-4 border-t ${isDarkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}>
                  <div className="flex gap-3">
                    <button
                      onClick={handleClose}
                      disabled={isSubmitting}
                      className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                        isDarkMode
                          ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={!selectedStream || reason.trim().length < 10 || isSubmitting}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                        !selectedStream || reason.trim().length < 10 || isSubmitting
                          ? 'opacity-50 cursor-not-allowed'
                          : ''
                      } bg-blue-600 text-white hover:bg-blue-700`}
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Submit Request
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default RequestStreamChangeDialog;
