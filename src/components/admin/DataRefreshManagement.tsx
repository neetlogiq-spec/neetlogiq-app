'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  RefreshCw,
  Clock,
  Database,
  CheckCircle,
  AlertCircle,
  Calendar,
  TrendingUp
} from 'lucide-react';

interface DataRefreshStatus {
  lastCheck: string | null;
  nextCheck: string;
  isUsingPartitions: boolean;
  partitionCount: number | null;
  totalRecords: number | null;
}

const DataRefreshManagement: React.FC = () => {
  const [status, setStatus] = useState<DataRefreshStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [timeUntilNext, setTimeUntilNext] = useState<string>('');

  useEffect(() => {
    loadStatus();
    
    // Update countdown every minute
    const interval = setInterval(() => {
      loadStatus();
      updateCountdown();
    }, 60000);
    
    // Update countdown immediately
    updateCountdown();
    const countdownInterval = setInterval(updateCountdown, 1000);
    
    return () => {
      clearInterval(interval);
      clearInterval(countdownInterval);
    };
  }, []);

  const loadStatus = async () => {
    try {
      const response = await fetch('/api/admin/data-refresh');
      const result = await response.json();
      
      if (result.success) {
        setStatus(result.status);
      }
    } catch (error) {
      console.error('Failed to load refresh status:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const response = await fetch('/api/admin/data-refresh', {
        method: 'POST',
      });
      
      const result = await response.json();
      
      if (result.success) {
        setStatus(result.status);
        // Show success message
        alert('✅ Data refreshed successfully! New partitions will be available immediately.');
      } else {
        alert(`❌ Failed to refresh: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to refresh data:', error);
      alert('❌ Failed to refresh data. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  const updateCountdown = () => {
    if (!status?.nextCheck) return;
    
    const next = new Date(status.nextCheck);
    const now = new Date();
    const diff = next.getTime() - now.getTime();
    
    if (diff <= 0) {
      setTimeUntilNext('Due now - check pending');
      loadStatus(); // Refresh status
      return;
    }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    if (days > 0) {
      setTimeUntilNext(`${days}d ${hours}h ${minutes}m`);
    } else if (hours > 0) {
      setTimeUntilNext(`${hours}h ${minutes}m ${seconds}s`);
    } else if (minutes > 0) {
      setTimeUntilNext(`${minutes}m ${seconds}s`);
    } else {
      setTimeUntilNext(`${seconds}s`);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  if (!status) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-center">
          <RefreshCw className="w-5 h-5 animate-spin text-gray-400 mr-2" />
          <span className="text-gray-600 dark:text-gray-400">Loading refresh status...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Data Refresh Management
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Manage partition discovery and data refresh schedule
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh Now'}
        </button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Last Check */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/20">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4 flex-1">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Last Check
              </p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {status.lastCheck ? (
                  <>
                    {formatDate(status.lastCheck).split(',')[0]}
                    <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {formatDate(status.lastCheck).split(',')[1]}
                    </span>
                  </>
                ) : (
                  'Never'
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Next Check */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/20">
              <Calendar className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4 flex-1">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Next Check
              </p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {formatDate(status.nextCheck).split(',')[0]}
                <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {timeUntilNext || formatDate(status.nextCheck).split(',')[1]}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Partition Count */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/20">
              <Database className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4 flex-1">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Partitions
              </p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {status.partitionCount !== null ? (
                  <>
                    {status.partitionCount.toLocaleString()}
                    <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {status.isUsingPartitions ? 'Active' : 'Not available'}
                    </span>
                  </>
                ) : (
                  'N/A'
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Total Records */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-orange-100 dark:bg-orange-900/20">
              <TrendingUp className="w-6 h-6 text-orange-600" />
            </div>
            <div className="ml-4 flex-1">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Records
              </p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {status.totalRecords !== null ? (
                  status.totalRecords.toLocaleString()
                ) : (
                  'N/A'
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Info Section */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <div className="flex">
          <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-800 dark:text-blue-400">
            <p className="font-medium mb-1">Automatic Refresh Schedule</p>
            <p className="mb-2">
              The system automatically checks for new partitions every <strong>1 week</strong>. 
              If you add new data right after a check, use the "Refresh Now" button above to 
              discover it immediately without waiting.
            </p>
            <p className="text-xs mt-2">
              <strong>Note:</strong> DuckDB also discovers new partition files automatically 
              during queries, so new data may still be available even before the scheduled check.
            </p>
          </div>
        </div>
      </div>

      {/* Countdown Timer */}
      {status.nextCheck && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-900 dark:text-blue-400 mb-1">
                Time Until Next Automatic Check
              </p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {timeUntilNext || 'Calculating...'}
              </p>
            </div>
            <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400">
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm font-medium">
                {status.isUsingPartitions ? 'Partitions Active' : 'Single File Mode'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataRefreshManagement;

