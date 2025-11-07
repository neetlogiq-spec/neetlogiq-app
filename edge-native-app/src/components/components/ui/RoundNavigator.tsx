'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Calendar, Info } from 'lucide-react';

interface RoundNavigatorProps {
  counsellingBody: 'AIQ' | 'KEA';
  year: string;
  level: 'UG' | 'PG' | 'DNB';
  availableRounds: number[];
  selectedRound: number;
  onRoundChange: (round: number) => void;
  isDarkMode: boolean;
  className?: string;
}

interface RoundInfo {
  round: number;
  date: string;
  status: 'completed' | 'ongoing' | 'upcoming';
  seatCount: number;
  description: string;
}

const RoundNavigator: React.FC<RoundNavigatorProps> = ({
  counsellingBody,
  year,
  level,
  availableRounds,
  selectedRound,
  onRoundChange,
  isDarkMode,
  className = ''
}) => {
  const [roundInfo, setRoundInfo] = useState<Record<number, RoundInfo>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [showInfo, setShowInfo] = useState(false);

  // Mock round information - in production, this would come from the JSON data
  useEffect(() => {
    const mockRoundInfo: Record<number, RoundInfo> = {
      1: {
        round: 1,
        date: counsellingBody === 'AIQ' ? 'Oct 2024' : 'Nov 2024',
        status: 'completed',
        seatCount: 15000,
        description: 'First round of counselling with maximum seat availability'
      },
      2: {
        round: 2,
        date: counsellingBody === 'AIQ' ? 'Nov 2024' : 'Dec 2024',
        status: 'completed',
        seatCount: 8000,
        description: 'Second round for vacant seats after round 1'
      },
      3: {
        round: 3,
        date: counsellingBody === 'AIQ' ? 'Dec 2024' : 'Jan 2025',
        status: 'completed',
        seatCount: 3000,
        description: 'Mop-up round for remaining vacant seats'
      },
      4: {
        round: 4,
        date: counsellingBody === 'AIQ' ? 'Jan 2025' : 'Feb 2025',
        status: 'ongoing',
        seatCount: 1000,
        description: 'Stray vacancy round for last remaining seats'
      }
    };

    // Filter to only include available rounds
    const filteredInfo: Record<number, RoundInfo> = {};
    availableRounds.forEach(round => {
      if (mockRoundInfo[round]) {
        filteredInfo[round] = mockRoundInfo[round];
      }
    });

    setRoundInfo(filteredInfo);
    setIsLoading(false);
  }, [counsellingBody, availableRounds]);

  const handlePreviousRound = () => {
    const currentIndex = availableRounds.indexOf(selectedRound);
    if (currentIndex > 0) {
      onRoundChange(availableRounds[currentIndex - 1]);
    }
  };

  const handleNextRound = () => {
    const currentIndex = availableRounds.indexOf(selectedRound);
    if (currentIndex < availableRounds.length - 1) {
      onRoundChange(availableRounds[currentIndex + 1]);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return isDarkMode ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-green-100 text-green-800 border-green-200';
      case 'ongoing':
        return isDarkMode ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-blue-100 text-blue-800 border-blue-200';
      case 'upcoming':
        return isDarkMode ? 'bg-gray-500/20 text-gray-400 border-gray-500/30' : 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return isDarkMode ? 'bg-gray-500/20 text-gray-400 border-gray-500/30' : 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const currentRoundIndex = availableRounds.indexOf(selectedRound);
  const isFirstRound = currentRoundIndex === 0;
  const isLastRound = currentRoundIndex === availableRounds.length - 1;

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center p-4 ${className}`}>
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className={`backdrop-blur-md rounded-xl p-4 border-2 ${isDarkMode ? 'bg-white/10 border-white/20' : 'bg-white/80 border-gray-200/60'} ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className={`w-5 h-5 ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`} />
          <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Round {selectedRound}
          </h3>
          {roundInfo[selectedRound] && (
            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(roundInfo[selectedRound].status)}`}>
              {roundInfo[selectedRound].status}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowInfo(!showInfo)}
          className={`p-1 rounded-full transition-colors ${isDarkMode ? 'hover:bg-white/10 text-white/70' : 'hover:bg-gray-100 text-gray-600'}`}
        >
          <Info className="w-4 h-4" />
        </button>
      </div>

      {/* Round Info */}
      <AnimatePresence>
        {showInfo && roundInfo[selectedRound] && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className={`mb-4 p-3 rounded-lg ${isDarkMode ? 'bg-white/5' : 'bg-gray-50'}`}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div>
                <span className={`font-medium ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>Date:</span>
                <span className={`ml-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{roundInfo[selectedRound].date}</span>
              </div>
              <div>
                <span className={`font-medium ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>Seats:</span>
                <span className={`ml-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{roundInfo[selectedRound].seatCount.toLocaleString()}</span>
              </div>
              <div className="md:col-span-3">
                <span className={`font-medium ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>Description:</span>
                <span className={`ml-2 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>{roundInfo[selectedRound].description}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Round Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={handlePreviousRound}
          disabled={isFirstRound}
          className={`p-2 rounded-lg transition-all ${
            isFirstRound
              ? 'opacity-50 cursor-not-allowed'
              : isDarkMode
              ? 'hover:bg-white/10 text-white/70'
              : 'hover:bg-gray-100 text-gray-600'
          }`}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Round Indicators */}
        <div className="flex items-center gap-2">
          {availableRounds.map((round) => (
            <button
              key={round}
              onClick={() => onRoundChange(round)}
              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                round === selectedRound
                  ? isDarkMode
                    ? 'bg-blue-500 text-white'
                    : 'bg-blue-600 text-white'
                  : isDarkMode
                  ? 'bg-white/10 text-white/70 hover:bg-white/20'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {round}
            </button>
          ))}
        </div>

        <button
          onClick={handleNextRound}
          disabled={isLastRound}
          className={`p-2 rounded-lg transition-all ${
            isLastRound
              ? 'opacity-50 cursor-not-allowed'
              : isDarkMode
              ? 'hover:bg-white/10 text-white/70'
              : 'hover:bg-gray-100 text-gray-600'
          }`}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Round Summary */}
      <div className={`mt-4 pt-3 border-t ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}>
        <div className="flex items-center justify-between text-sm">
          <span className={isDarkMode ? 'text-white/70' : 'text-gray-600'}>
            {counsellingBody} {year} {level}
          </span>
          <span className={isDarkMode ? 'text-white/70' : 'text-gray-600'}>
            Round {currentRoundIndex + 1} of {availableRounds.length}
          </span>
        </div>
      </div>
    </div>
  );
};

export default RoundNavigator;
