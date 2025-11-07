'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Circle } from 'lucide-react';

interface ProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
  selectedCount: number;
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  currentStep,
  totalSteps,
  selectedCount
}) => {
  const progressPercentage = ((currentStep - 1) / (totalSteps - 1)) * 100;

  const steps = [
    { number: 1, label: 'Choose First College', completed: selectedCount >= 1 },
    { number: 2, label: 'Choose Second College', completed: selectedCount >= 2 },
    { number: 3, label: 'Add More Colleges', completed: selectedCount >= 3 },
    { number: 4, label: 'Add Final College', completed: selectedCount >= 4 },
    { number: 5, label: 'Compare Results', completed: selectedCount >= 2 }
  ];

  return (
    <motion.div 
      className="bg-white dark:bg-gray-800 shadow-lg border-b border-gray-200 dark:border-gray-700"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Progress
            </span>
            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
              {Math.round(progressPercentage)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <motion.div
              className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercentage}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Step Indicators */}
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.number} className="flex flex-col items-center">
              <motion.div
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                  step.completed
                    ? 'bg-green-500 text-white'
                    : currentStep === step.number
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400'
                }`}
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                {step.completed ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <Circle className="w-5 h-5" />
                )}
              </motion.div>
              <motion.span
                className={`text-xs mt-2 text-center max-w-20 ${
                  step.completed
                    ? 'text-green-600 dark:text-green-400 font-medium'
                    : currentStep === step.number
                    ? 'text-blue-600 dark:text-blue-400 font-medium'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: index * 0.1 + 0.2 }}
              >
                {step.label}
              </motion.span>
            </div>
          ))}
        </div>

        {/* Current Status */}
        <motion.div 
          className="mt-4 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {selectedCount === 0 && "Start by selecting your first college"}
            {selectedCount === 1 && "Great! Now select your second college"}
            {selectedCount === 2 && "Perfect! You can add up to 2 more colleges or compare now"}
            {selectedCount === 3 && "Almost there! Add one more college or compare with 3"}
            {selectedCount === 4 && "Excellent! You've selected the maximum number of colleges"}
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default ProgressIndicator;
