'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, X, Star, Zap, Award } from 'lucide-react';

interface AchievementToastProps {
  achievement: string;
  onClose: () => void;
}

const AchievementToast: React.FC<AchievementToastProps> = ({
  achievement,
  onClose
}) => {
  const getAchievementIcon = (achievement: string) => {
    if (achievement.includes('First')) return <Star className="w-6 h-6" />;
    if (achievement.includes('Maximum')) return <Trophy className="w-6 h-6" />;
    if (achievement.includes('Perfect')) return <Zap className="w-6 h-6" />;
    return <Award className="w-6 h-6" />;
  };

  const getAchievementColor = (achievement: string) => {
    if (achievement.includes('First')) return 'from-yellow-400 to-orange-500';
    if (achievement.includes('Maximum')) return 'from-purple-400 to-pink-500';
    if (achievement.includes('Perfect')) return 'from-green-400 to-blue-500';
    return 'from-blue-400 to-purple-500';
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4000);

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed top-4 right-4 z-50"
        initial={{ opacity: 0, x: 300, scale: 0.8 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: 300, scale: 0.8 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className={`bg-gradient-to-r ${getAchievementColor(achievement)} p-4 rounded-2xl shadow-2xl border border-white/20 backdrop-blur-sm`}>
          <div className="flex items-center gap-3">
            <div className="text-white">
              {getAchievementIcon(achievement)}
            </div>
            <div className="flex-1">
              <div className="text-white font-bold text-lg">
                🎉 Achievement Unlocked!
              </div>
              <div className="text-white/90 text-sm">
                {achievement}
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white transition-colors duration-200 p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Progress bar */}
          <motion.div
            className="mt-3 h-1 bg-white/20 rounded-full overflow-hidden"
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: 4, ease: "linear" }}
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AchievementToast;
