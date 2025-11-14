'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Clock, X, Building2 } from 'lucide-react';

interface RecentCollege {
  id: string;
  name: string;
  city: string;
  state: string;
  viewedAt: number;
}

const STORAGE_KEY = 'neetlogiq_recent_colleges';
const MAX_RECENT = 10;

export const addToRecentlyViewed = (college: Omit<RecentCollege, 'viewedAt'>) => {
  if (typeof window === 'undefined') return;

  try {
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as RecentCollege[];

    // Remove if already exists
    const filtered = existing.filter(c => c.id !== college.id);

    // Add to beginning
    const updated: RecentCollege[] = [
      { ...college, viewedAt: Date.now() },
      ...filtered,
    ].slice(0, MAX_RECENT);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    // Dispatch event for other components to update
    window.dispatchEvent(new Event('recentlyViewedUpdated'));
  } catch (error) {
    console.error('Error saving to recently viewed:', error);
  }
};

export const getRecentlyViewed = (): RecentCollege[] => {
  if (typeof window === 'undefined') return [];

  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch (error) {
    console.error('Error reading recently viewed:', error);
    return [];
  }
};

export const clearRecentlyViewed = () => {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event('recentlyViewedUpdated'));
};

const RecentlyViewed: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const [recent, setRecent] = useState<RecentCollege[]>([]);

  useEffect(() => {
    // Load initial data
    setRecent(getRecentlyViewed());

    // Listen for updates
    const handleUpdate = () => {
      setRecent(getRecentlyViewed());
    };

    window.addEventListener('recentlyViewedUpdated', handleUpdate);

    return () => {
      window.removeEventListener('recentlyViewedUpdated', handleUpdate);
    };
  }, []);

  const removeItem = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const existing = getRecentlyViewed();
      const filtered = existing.filter(c => c.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      setRecent(filtered);
      window.dispatchEvent(new Event('recentlyViewedUpdated'));
    } catch (error) {
      console.error('Error removing item:', error);
    }
  };

  const handleClearAll = () => {
    clearRecentlyViewed();
    setRecent([]);
  };

  if (recent.length === 0) {
    return null;
  }

  if (compact) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Recently Viewed
            </h3>
          </div>
          {recent.length > 0 && (
            <button
              onClick={handleClearAll}
              className="text-xs text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>

        <div className="space-y-2">
          {recent.slice(0, 5).map(college => (
            <Link
              key={college.id}
              href={`/colleges/${college.id}`}
              className="flex items-center space-x-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-900/50 rounded-lg transition-colors group"
            >
              <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Building2 className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {college.name}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                  {college.city}, {college.state}
                </p>
              </div>
              <button
                onClick={(e) => removeItem(college.id, e)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-opacity"
              >
                <X className="h-3 w-3 text-gray-500" />
              </button>
            </Link>
          ))}
        </div>

        {recent.length > 5 && (
          <Link
            href="/dashboard/recent"
            className="block mt-3 text-xs text-blue-600 dark:text-blue-400 hover:underline text-center"
          >
            View all {recent.length} colleges
          </Link>
        )}
      </div>
    );
  }

  // Full page layout
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl">
            <Clock className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Recently Viewed Colleges
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {recent.length} college{recent.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button
          onClick={handleClearAll}
          className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
        >
          Clear All
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {recent.map(college => (
          <Link
            key={college.id}
            href={`/colleges/${college.id}`}
            className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-all hover:-translate-y-1"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Building2 className="h-6 w-6 text-white" />
              </div>
              <button
                onClick={(e) => removeItem(college.id, e)}
                className="p-2 opacity-0 group-hover:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-opacity"
              >
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
              {college.name}
            </h3>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              {college.city}, {college.state}
            </p>

            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>Viewed {formatTimeAgo(college.viewedAt)}</span>
              <span className="text-blue-600 dark:text-blue-400 group-hover:underline">
                View details →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export default RecentlyViewed;
