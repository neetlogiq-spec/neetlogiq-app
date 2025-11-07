'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Slider } from '@/components/ui/slider';
import { useTheme } from '@/contexts/ThemeContext';

interface RankRangeSliderProps {
  minRank: number;
  maxRank: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
  isDarkMode?: boolean;
  title?: string;
  description?: string;
}

const RankRangeSlider: React.FC<RankRangeSliderProps> = ({
  minRank,
  maxRank,
  value,
  onChange,
  isDarkMode = false,
  title = 'Rank Range',
  description = 'Filter by opening and closing rank range'
}) => {
  const [localValue, setLocalValue] = useState<[number, number]>(value);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize the slider with the current value
  useEffect(() => {
    if (!isInitialized) {
      setLocalValue(value);
      setIsInitialized(true);
    }
  }, [value, isInitialized]);

  // Handle slider change
  const handleChange = useCallback((newValue: number[]) => {
    const rangeValue: [number, number] = [newValue[0], newValue[1]];
    setLocalValue(rangeValue);
    onChange(rangeValue);
  }, [onChange]);

  // Format rank number for display
  const formatRank = (rank: number) => {
    if (rank >= 100000) {
      return `${(rank / 100000).toFixed(1)}L`;
    } else if (rank >= 1000) {
      return `${(rank / 1000).toFixed(0)}K`;
    }
    return rank.toString();
  };

  return (
      <div className={`p-2 rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="mb-3">
          <h3 className={`text-xs font-medium mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {title}
          </h3>
          <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            {description}
          </p>
        </div>
      
        <div className="mb-4">
          <Slider
            value={localValue}
            onValueChange={handleChange}
            min={minRank}
            max={maxRank}
            step={1}
            className="w-full"
          />
        </div>
        
        <div className="flex justify-between items-center">
          <div className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            <span className="font-medium">Min:</span> {formatRank(localValue[0])}
          </div>
          <div className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            <span className="font-medium">Max:</span> {formatRank(localValue[1])}
          </div>
        </div>
        
        <div className={`mt-1 text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
          Range: {formatRank(localValue[1] - localValue[0])} ranks
        </div>
    </div>
  );
};

export default RankRangeSlider;
