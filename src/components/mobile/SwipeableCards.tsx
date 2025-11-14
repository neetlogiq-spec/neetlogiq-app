/**
 * SwipeableCards Component
 *
 * Tinder-like swipeable college discovery for mobile with:
 * - Drag to swipe left/right
 * - Swipe right to save/like
 * - Swipe left to skip
 * - Swipe up for more details
 * - Stack animation effect
 * - Undo last action
 * - Match animation when saved
 */

'use client';

import React, { useState, useRef } from 'react';
import { motion, useMotionValue, useTransform, PanInfo, AnimatePresence } from 'framer-motion';
import {
  Heart,
  X,
  Info,
  RotateCcw,
  MapPin,
  DollarSign,
  TrendingUp,
  Award,
  ChevronUp,
  Sparkles,
  Star
} from 'lucide-react';

export interface SwipeableCollege {
  id: string;
  name: string;
  city: string;
  state: string;
  image?: string;
  managementType: 'Government' | 'Private' | 'Trust' | 'Deemed';
  closingRank: number;
  tuitionFee: number;
  totalAnnualCost: number;
  niacRating: string;
  nirfRank?: number;
  admissionChance: number;
  placementRate: number;
  facilities: {
    hostel: boolean;
    library: boolean;
    labs: boolean;
    sports: boolean;
  };
  highlights: string[];
}

interface SwipeableCardsProps {
  colleges: SwipeableCollege[];
  onLike?: (college: SwipeableCollege) => void;
  onSkip?: (college: SwipeableCollege) => void;
  onViewDetails?: (college: SwipeableCollege) => void;
  userRank?: number;
}

export default function SwipeableCards({
  colleges: initialColleges,
  onLike,
  onSkip,
  onViewDetails,
  userRank = 5000
}: SwipeableCardsProps) {
  const [colleges, setColleges] = useState(initialColleges);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeHistory, setSwipeHistory] = useState<Array<{ college: SwipeableCollege; action: 'like' | 'skip' }>>([]);
  const [showMatchAnimation, setShowMatchAnimation] = useState(false);
  const [isSwipingUp, setIsSwipingUp] = useState(false);

  const currentCollege = colleges[currentIndex];

  const handleSwipe = (direction: 'left' | 'right' | 'up', college: SwipeableCollege) => {
    if (direction === 'right') {
      // Liked
      setSwipeHistory([...swipeHistory, { college, action: 'like' }]);
      onLike?.(college);
      setShowMatchAnimation(true);
      setTimeout(() => setShowMatchAnimation(false), 1500);
    } else if (direction === 'left') {
      // Skipped
      setSwipeHistory([...swipeHistory, { college, action: 'skip' }]);
      onSkip?.(college);
    } else if (direction === 'up') {
      // View details
      onViewDetails?.(college);
      return; // Don't move to next card
    }

    // Move to next card
    setTimeout(() => {
      setCurrentIndex((prev) => prev + 1);
    }, 300);
  };

  const handleUndo = () => {
    if (swipeHistory.length === 0 || currentIndex === 0) return;

    const lastAction = swipeHistory[swipeHistory.length - 1];
    setSwipeHistory(swipeHistory.slice(0, -1));
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  if (!currentCollege) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6">
        <div className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
          >
            <Sparkles className="w-20 h-20 text-blue-600 mx-auto mb-4" />
          </motion.div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            That's all for now!
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            You've reviewed all available colleges
          </p>
          <button
            onClick={() => {
              setCurrentIndex(0);
              setSwipeHistory([]);
            }}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
          >
            Start Over
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 overflow-hidden">
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {currentIndex + 1} of {colleges.length}
            </span>
            <button
              onClick={handleUndo}
              disabled={swipeHistory.length === 0}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RotateCcw className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
          <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${((currentIndex + 1) / colleges.length) * 100}%` }}
              transition={{ duration: 0.3 }}
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
            />
          </div>
        </div>
      </div>

      {/* Card Stack Container */}
      <div className="fixed inset-0 flex items-center justify-center p-6 pt-28 pb-32">
        <div className="relative w-full max-w-md h-full">
          {/* Render next 3 cards in stack */}
          {colleges.slice(currentIndex, currentIndex + 3).map((college, index) => {
            if (index > 0) {
              // Background stack cards
              return (
                <motion.div
                  key={college.id}
                  initial={{ scale: 1 - index * 0.05, y: index * 10 }}
                  animate={{ scale: 1 - index * 0.05, y: index * 10 }}
                  className="absolute inset-0 pointer-events-none"
                  style={{ zIndex: 3 - index }}
                >
                  <CollegeCard college={college} userRank={userRank} isBackground />
                </motion.div>
              );
            }

            // Active card (top of stack)
            return (
              <SwipeableCard
                key={college.id}
                college={college}
                userRank={userRank}
                onSwipe={(direction) => handleSwipe(direction, college)}
                style={{ zIndex: 10 }}
              />
            );
          })}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="fixed bottom-8 left-0 right-0 z-50">
        <div className="flex items-center justify-center space-x-4 px-6">
          {/* Skip Button */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => handleSwipe('left', currentCollege)}
            className="w-16 h-16 bg-white dark:bg-gray-800 rounded-full shadow-xl flex items-center justify-center border-2 border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <X className="w-8 h-8" />
          </motion.button>

          {/* Info Button */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => handleSwipe('up', currentCollege)}
            className="w-14 h-14 bg-white dark:bg-gray-800 rounded-full shadow-lg flex items-center justify-center border border-gray-300 dark:border-gray-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
          >
            <Info className="w-6 h-6" />
          </motion.button>

          {/* Like Button */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => handleSwipe('right', currentCollege)}
            className="w-16 h-16 bg-gradient-to-br from-pink-500 to-red-500 rounded-full shadow-xl flex items-center justify-center text-white hover:from-pink-600 hover:to-red-600 transition-colors"
          >
            <Heart className="w-8 h-8 fill-white" />
          </motion.button>
        </div>
      </div>

      {/* Match Animation */}
      <AnimatePresence>
        {showMatchAnimation && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: 50 }}
              animate={{ y: 0 }}
              className="text-center"
            >
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                  rotate: [0, 10, -10, 0]
                }}
                transition={{ duration: 0.6, repeat: 1 }}
                className="mb-6"
              >
                <Heart className="w-24 h-24 text-pink-500 fill-pink-500 mx-auto" />
              </motion.div>
              <h2 className="text-4xl font-bold text-white mb-2">It's a Match!</h2>
              <p className="text-xl text-gray-300">College saved to your favorites</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Swipe Hints (shown on first card) */}
      {currentIndex === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="fixed top-32 left-0 right-0 z-40 flex justify-center px-6"
        >
          <div className="bg-white dark:bg-gray-800 px-6 py-3 rounded-full shadow-lg border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Swipe right to save • Swipe left to skip • Swipe up for details
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}

/**
 * Individual Swipeable Card Component
 */
function SwipeableCard({
  college,
  userRank,
  onSwipe,
  style
}: {
  college: SwipeableCollege;
  userRank: number;
  onSwipe: (direction: 'left' | 'right' | 'up') => void;
  style?: React.CSSProperties;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-200, 0, 200], [-25, 0, 25]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0, 1, 1, 1, 0]);

  const likeOpacity = useTransform(x, [0, 100], [0, 1]);
  const nopeOpacity = useTransform(x, [0, -100], [0, 1]);

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 100;
    const velocity = info.velocity.x;

    // Check for swipe up
    if (info.offset.y < -threshold) {
      onSwipe('up');
      return;
    }

    // Check for left/right swipe
    if (Math.abs(info.offset.x) > threshold || Math.abs(velocity) > 500) {
      if (info.offset.x > 0) {
        onSwipe('right');
      } else {
        onSwipe('left');
      }
    }
  };

  return (
    <motion.div
      drag
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      onDragEnd={handleDragEnd}
      style={{ x, y, rotate, opacity, ...style }}
      className="absolute inset-0 cursor-grab active:cursor-grabbing"
    >
      <CollegeCard college={college} userRank={userRank}>
        {/* Like/Nope Overlays */}
        <motion.div
          style={{ opacity: likeOpacity }}
          className="absolute top-12 right-12 z-10 px-6 py-3 border-4 border-green-500 text-green-500 font-bold text-3xl rotate-12 rounded-xl bg-white/90"
        >
          LIKE
        </motion.div>
        <motion.div
          style={{ opacity: nopeOpacity }}
          className="absolute top-12 left-12 z-10 px-6 py-3 border-4 border-red-500 text-red-500 font-bold text-3xl -rotate-12 rounded-xl bg-white/90"
        >
          NOPE
        </motion.div>
      </CollegeCard>
    </motion.div>
  );
}

/**
 * College Card Component
 */
function CollegeCard({
  college,
  userRank,
  isBackground = false,
  children
}: {
  college: SwipeableCollege;
  userRank: number;
  isBackground?: boolean;
  children?: React.ReactNode;
}) {
  const canGetIn = userRank <= college.closingRank;

  return (
    <div className={`relative w-full h-full bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden ${isBackground ? 'pointer-events-none' : ''}`}>
      {children}

      {/* Image Section */}
      <div className="relative h-72 bg-gradient-to-br from-blue-500 to-purple-600">
        {college.image ? (
          <img src={college.image} alt={college.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Award className="w-24 h-24 text-white/30" />
          </div>
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

        {/* Admission Chance Badge */}
        <div className="absolute top-4 right-4">
          <div className={`px-4 py-2 rounded-full font-bold text-white backdrop-blur-xl ${
            college.admissionChance >= 80
              ? 'bg-green-500/90'
              : college.admissionChance >= 50
              ? 'bg-yellow-500/90'
              : 'bg-red-500/90'
          }`}>
            {college.admissionChance}% Chance
          </div>
        </div>

        {/* College Name */}
        <div className="absolute bottom-4 left-4 right-4">
          <h2 className="text-2xl font-bold text-white mb-1">{college.name}</h2>
          <div className="flex items-center text-white/90 text-sm">
            <MapPin className="w-4 h-4 mr-1" />
            <span>{college.city}, {college.state}</span>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-6 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(100% - 18rem)' }}>
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <TrendingUp className="w-5 h-5 text-blue-600 mx-auto mb-1" />
            <div className="text-sm font-bold text-gray-900 dark:text-white">
              {college.closingRank}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Rank</div>
          </div>

          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <DollarSign className="w-5 h-5 text-green-600 mx-auto mb-1" />
            <div className="text-sm font-bold text-gray-900 dark:text-white">
              ₹{(college.totalAnnualCost / 1000).toFixed(0)}K
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Annual</div>
          </div>

          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <Award className="w-5 h-5 text-purple-600 mx-auto mb-1" />
            <div className="text-sm font-bold text-gray-900 dark:text-white">
              {college.niacRating}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Rating</div>
          </div>
        </div>

        {/* Management Type & NIRF */}
        <div className="flex items-center justify-between text-sm">
          <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full font-medium">
            {college.managementType}
          </span>
          {college.nirfRank && (
            <span className="text-gray-600 dark:text-gray-400">
              NIRF Rank: <span className="font-bold text-gray-900 dark:text-white">#{college.nirfRank}</span>
            </span>
          )}
        </div>

        {/* Highlights */}
        {college.highlights.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Highlights</h4>
            <div className="space-y-1">
              {college.highlights.slice(0, 3).map((highlight, index) => (
                <div key={index} className="flex items-start space-x-2">
                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">{highlight}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Can Get In Indicator */}
        {canGetIn ? (
          <div className="flex items-center space-x-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
            <Sparkles className="w-5 h-5 text-green-600 dark:text-green-400" />
            <span className="text-sm font-medium text-green-800 dark:text-green-300">
              You can get admission here!
            </span>
          </div>
        ) : (
          <div className="flex items-center space-x-2 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl">
            <Info className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            <span className="text-sm font-medium text-orange-800 dark:text-orange-300">
              Rank {college.closingRank - userRank} seats away
            </span>
          </div>
        )}

        {/* Swipe Up Hint */}
        <div className="flex items-center justify-center space-x-2 text-gray-400 dark:text-gray-600">
          <ChevronUp className="w-4 h-4" />
          <span className="text-xs">Swipe up for full details</span>
          <ChevronUp className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}
