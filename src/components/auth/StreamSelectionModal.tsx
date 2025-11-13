'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  GraduationCap, 
  Stethoscope, 
  Activity,
  X,
  ArrowRight
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { User } from '@/types';
import StreamLockConfirmationModal from './StreamLockConfirmationModal';

interface StreamSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (stream: 'UG' | 'PG_MEDICAL' | 'PG_DENTAL') => Promise<void>;
}

const StreamSelectionModal: React.FC<StreamSelectionModalProps> = ({ 
  isOpen, 
  onClose, 
  onComplete 
}) => {
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const [selectedStream, setSelectedStream] = useState<'UG' | 'PG_MEDICAL' | 'PG_DENTAL' | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const streams = [
    {
      id: 'UG' as const,
      name: 'Undergraduate',
      shortName: 'UG',
      description: 'MBBS, BDS and other undergraduate medical courses',
      icon: GraduationCap,
      color: 'blue',
      bgColor: isDarkMode ? 'bg-blue-900/30' : 'bg-blue-50',
      borderColor: isDarkMode ? 'border-blue-700' : 'border-blue-200',
      textColor: isDarkMode ? 'text-blue-300' : 'text-blue-700'
    },
    {
      id: 'PG_MEDICAL' as const,
      name: 'Postgraduate Medical',
      shortName: 'PG Medical',
      description: 'MD, MS, DM, MCh and other postgraduate medical courses',
      icon: Stethoscope,
      color: 'green',
      bgColor: isDarkMode ? 'bg-green-900/30' : 'bg-green-50',
      borderColor: isDarkMode ? 'border-green-700' : 'border-green-200',
      textColor: isDarkMode ? 'text-green-300' : 'text-green-700'
    },
    {
      id: 'PG_DENTAL' as const,
      name: 'Postgraduate Dental',
      shortName: 'PG Dental',
      description: 'MDS and other postgraduate dental courses',
      icon: Activity,
      color: 'purple',
      bgColor: isDarkMode ? 'bg-purple-900/30' : 'bg-purple-50',
      borderColor: isDarkMode ? 'border-purple-700' : 'border-purple-200',
      textColor: isDarkMode ? 'text-purple-300' : 'text-purple-700'
    }
  ];

  const handleContinue = () => {
    if (!selectedStream) return;
    // Show confirmation modal
    setShowConfirmation(true);
  };

  const handleConfirmLock = async () => {
    if (!selectedStream) return;

    setIsSubmitting(true);
    try {
      // Save the selected stream to user profile (will lock it)
      await onComplete(selectedStream);
      setShowConfirmation(false);
      onClose();
    } catch (error) {
      console.error('Error saving stream selection:', error);
      alert('Failed to save stream selection. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedStreamInfo = streams.find(s => s.id === selectedStream);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
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
            {/* Header */}
            <div className={`px-6 py-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Welcome to NeetLogIQ, {user?.givenName || user?.displayName}!
                  </h2>
                  <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Select your academic stream to personalize your experience
                  </p>
                </div>
                <button
                  onClick={onClose}
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
            <div className="p-6">
              <div className="grid gap-4 md:grid-cols-3">
                {streams.map((stream) => {
                  const Icon = stream.icon;
                  const isSelected = selectedStream === stream.id;
                  
                  return (
                    <motion.div
                      key={stream.id}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedStream(stream.id)}
                      className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        isSelected
                          ? `${stream.bgColor} ${stream.borderColor} ${stream.textColor} border-opacity-100`
                          : isDarkMode
                          ? 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
                          : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {isSelected && (
                        <div className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center ${
                          isDarkMode ? 'bg-gray-700' : 'bg-white'
                        }`}>
                          <div className={`w-3 h-3 rounded-full bg-${stream.color}-500`} />
                        </div>
                      )}
                      
                      <div className="flex flex-col items-center text-center">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${
                          isSelected
                            ? `bg-${stream.color}-500 text-white`
                            : isDarkMode
                            ? 'bg-gray-700 text-gray-300'
                            : 'bg-white text-gray-700 shadow-sm'
                        }`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        
                        <h3 className={`font-semibold mb-1 ${
                          isSelected ? stream.textColor : isDarkMode ? 'text-white' : 'text-gray-900'
                        }`}>
                          {stream.name}
                        </h3>
                        
                        <p className={`text-xs ${
                          isSelected ? stream.textColor : isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          {stream.description}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
              
              <div className={`mt-6 p-4 rounded-lg ${
                isDarkMode ? 'bg-orange-900/20 border border-orange-700' : 'bg-orange-50 border border-orange-200'
              }`}>
                <p className={`text-sm ${isDarkMode ? 'text-orange-300' : 'text-orange-800'}`}>
                  <strong>⚠️ Important:</strong> Your stream selection will be <strong>locked permanently</strong> after confirmation to ensure data consistency. You will need to contact support to change it later.
                </p>
              </div>
            </div>
            
            {/* Footer */}
            <div className={`px-6 py-4 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className="flex justify-end">
                <button
                  onClick={handleContinue}
                  disabled={!selectedStream}
                  className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all ${
                    !selectedStream
                      ? 'opacity-50 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Stream Lock Confirmation Modal */}
      <StreamLockConfirmationModal
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={handleConfirmLock}
        streamName={selectedStreamInfo?.name || ''}
        streamDescription={selectedStreamInfo?.description || ''}
        isLoading={isSubmitting}
      />
    </AnimatePresence>
  );
};

export default StreamSelectionModal;
