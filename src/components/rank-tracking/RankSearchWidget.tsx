'use client';

/**
 * Rank Search Widget
 *
 * Compact search bar component for tracking individual ranks
 * Placed at the top of cutoffs page
 */

import { useState } from 'react';
import { Search, TrendingUp, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Utility class for styled native select
const selectClassName = "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

interface RankSearchWidgetProps {
  onSearch: (rank: number, year: number, category: string, quota: string) => void;
  isLoading?: boolean;
}

export default function RankSearchWidget({ onSearch, isLoading }: RankSearchWidgetProps) {
  const [rank, setRank] = useState<string>('');
  const [year, setYear] = useState<string>('2024');
  const [category, setCategory] = useState<string>('General');
  const [quota, setQuota] = useState<string>('All India');
  const [error, setError] = useState<string>('');

  const handleSearch = () => {
    setError('');

    // Validate rank
    const rankNum = parseInt(rank);
    if (!rank || isNaN(rankNum) || rankNum < 1) {
      setError('Please enter a valid rank (positive number)');
      return;
    }

    if (rankNum > 1000000) {
      setError('Rank must be less than 1,000,000');
      return;
    }

    // Validate year
    const yearNum = parseInt(year);
    if (isNaN(yearNum) || yearNum < 2020 || yearNum > 2030) {
      setError('Please select a valid year');
      return;
    }

    // Call parent callback
    onSearch(rankNum, yearNum, category, quota);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <Card className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 border-2 border-blue-200 dark:border-blue-800">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Track Rank Journey
          </h3>
        </div>

        {/* Info Alert */}
        <Alert className="bg-blue-50 dark:bg-blue-900 border-blue-200 dark:border-blue-700">
          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-sm text-blue-800 dark:text-blue-200">
            Track individual rank allocations and upgrades through all counselling rounds.
            See which colleges were allocated and how many upgrades happened.
          </AlertDescription>
        </Alert>

        {/* Search Form */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {/* Rank Input */}
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Rank
            </label>
            <Input
              type="number"
              placeholder="Enter rank"
              value={rank}
              onChange={(e) => setRank(e.target.value)}
              onKeyPress={handleKeyPress}
              className="w-full"
              min={1}
              max={1000000}
              disabled={isLoading}
            />
          </div>

          {/* Year Select */}
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Year
            </label>
            <select 
              value={year} 
              onChange={(e) => setYear(e.target.value)} 
              disabled={isLoading}
              className={selectClassName}
            >
              <option value="2024">2024</option>
              <option value="2023">2023</option>
              <option value="2022">2022</option>
              <option value="2021">2021</option>
              <option value="2020">2020</option>
            </select>
          </div>

          {/* Category Select */}
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Category
            </label>
            <select 
              value={category} 
              onChange={(e) => setCategory(e.target.value)} 
              disabled={isLoading}
              className={selectClassName}
            >
              <option value="General">General</option>
              <option value="OBC">OBC</option>
              <option value="SC">SC</option>
              <option value="ST">ST</option>
              <option value="EWS">EWS</option>
            </select>
          </div>

          {/* Quota Select */}
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Quota
            </label>
            <select 
              value={quota} 
              onChange={(e) => setQuota(e.target.value)} 
              disabled={isLoading}
              className={selectClassName}
            >
              <option value="All India">All India</option>
              <option value="State">State</option>
              <option value="IP Delhi">IP Delhi</option>
              <option value="Management">Management</option>
            </select>
          </div>

          {/* Search Button */}
          <div className="md:col-span-1 flex items-end">
            <Button
              onClick={handleSearch}
              className="w-full"
              disabled={isLoading}
            >
              <Search className="w-4 h-4 mr-2" />
              {isLoading ? 'Searching...' : 'Track Rank'}
            </Button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Examples */}
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="text-gray-600 dark:text-gray-400">Try:</span>
          {[
            { rank: 123, year: 2024, cat: 'General', quota: 'All India' },
            { rank: 5000, year: 2023, cat: 'OBC', quota: 'State' },
            { rank: 1000, year: 2024, cat: 'SC', quota: 'All India' },
          ].map((example, idx) => (
            <button
              key={idx}
              onClick={() => {
                setRank(example.rank.toString());
                setYear(example.year.toString());
                setCategory(example.cat);
                setQuota(example.quota);
              }}
              className="px-2 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              disabled={isLoading}
            >
              Rank {example.rank.toLocaleString()} ({example.cat})
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}
