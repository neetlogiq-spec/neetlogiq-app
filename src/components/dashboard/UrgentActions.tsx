/**
 * UrgentActions Component
 *
 * Dashboard widget for time-sensitive actions with:
 * - Deadline countdown timers
 * - Priority-based sorting
 * - Quick action buttons
 * - Visual urgency indicators
 * - Dismissible items
 * - Category filtering
 * - Alert notifications
 */

'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  Clock,
  Calendar,
  X,
  ChevronRight,
  Bell,
  CheckCircle,
  FileText,
  DollarSign,
  Upload,
  Target,
  Filter,
  Zap,
  TrendingUp
} from 'lucide-react';

interface UrgentAction {
  id: string;
  title: string;
  description: string;
  deadline: Date;
  category: 'registration' | 'payment' | 'document' | 'choice' | 'application' | 'other';
  priority: 'critical' | 'high' | 'medium';
  actionUrl?: string;
  completed: boolean;
  icon: React.ComponentType<{ className?: string }>;
}

interface UrgentActionsProps {
  maxItems?: number;
  showCompleted?: boolean;
  allowDismiss?: boolean;
  onActionClick?: (action: UrgentAction) => void;
}

export default function UrgentActions({
  maxItems = 5,
  showCompleted = false,
  allowDismiss = true,
  onActionClick
}: UrgentActionsProps) {
  const [actions, setActions] = useState<UrgentAction[]>([
    {
      id: '1',
      title: 'Pay Registration Fee',
      description: 'Complete counseling registration payment of ₹2,000',
      deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      category: 'payment',
      priority: 'critical',
      completed: false,
      icon: DollarSign
    },
    {
      id: '2',
      title: 'Upload NEET Scorecard',
      description: 'Upload your NEET scorecard for document verification',
      deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
      category: 'document',
      priority: 'critical',
      completed: false,
      icon: Upload
    },
    {
      id: '3',
      title: 'Lock Choice Filling',
      description: 'Final date to lock your college preferences',
      deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days
      category: 'choice',
      priority: 'high',
      completed: false,
      icon: Target
    },
    {
      id: '4',
      title: 'Document Verification',
      description: 'Attend online document verification session',
      deadline: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), // 4 days
      category: 'registration',
      priority: 'high',
      completed: false,
      icon: FileText
    },
    {
      id: '5',
      title: 'Check Cutoff Updates',
      description: 'New cutoff data available for 2024',
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      category: 'other',
      priority: 'medium',
      completed: false,
      icon: TrendingUp
    }
  ]);

  const [filter, setFilter] = useState<'all' | UrgentAction['category']>('all');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

  const handleDismiss = (id: string) => {
    setActions(actions.filter(action => action.id !== id));
  };

  const handleComplete = (id: string) => {
    setActions(
      actions.map(action =>
        action.id === id ? { ...action, completed: true } : action
      )
    );
  };

  const handleAction = (action: UrgentAction) => {
    onActionClick?.(action);
    // Navigate to action URL if provided
    if (action.actionUrl) {
      window.location.href = action.actionUrl;
    }
  };

  const getTimeRemaining = (deadline: Date) => {
    const now = currentTime.getTime();
    const end = deadline.getTime();
    const diff = end - now;

    if (diff <= 0) {
      return { expired: true, text: 'Expired', color: 'red' };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    let text = '';
    let color = 'green';

    if (days > 0) {
      text = `${days}d ${hours}h`;
      color = days <= 2 ? 'red' : days <= 5 ? 'orange' : 'green';
    } else if (hours > 0) {
      text = `${hours}h ${minutes}m`;
      color = hours <= 6 ? 'red' : 'orange';
    } else {
      text = `${minutes}m`;
      color = 'red';
    }

    return { expired: false, text, color, days, hours, minutes };
  };

  const getCategoryColor = (category: UrgentAction['category']) => {
    const colors = {
      registration: 'blue',
      payment: 'green',
      document: 'purple',
      choice: 'orange',
      application: 'pink',
      other: 'gray'
    };
    return colors[category];
  };

  const getCategoryIcon = (category: UrgentAction['category']) => {
    const icons = {
      registration: FileText,
      payment: DollarSign,
      document: Upload,
      choice: Target,
      application: FileText,
      other: Bell
    };
    return icons[category];
  };

  // Filter actions
  let filteredActions = actions;
  if (filter !== 'all') {
    filteredActions = actions.filter(action => action.category === filter);
  }
  if (!showCompleted) {
    filteredActions = filteredActions.filter(action => !action.completed);
  }

  // Sort by deadline (most urgent first)
  filteredActions = filteredActions.sort((a, b) => a.deadline.getTime() - b.deadline.getTime());

  // Limit to maxItems
  const displayedActions = filteredActions.slice(0, maxItems);

  const criticalCount = actions.filter(a => !a.completed && getTimeRemaining(a.deadline).days <= 2).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Zap className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            {criticalCount > 0 && (
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center"
              >
                <span className="text-xs text-white font-bold">{criticalCount}</span>
              </motion.div>
            )}
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Urgent Actions
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {displayedActions.filter(a => !a.completed).length} pending tasks
            </p>
          </div>
        </div>

        {/* Filter */}
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All</option>
          <option value="registration">Registration</option>
          <option value="payment">Payment</option>
          <option value="document">Documents</option>
          <option value="choice">Choice Filling</option>
          <option value="application">Application</option>
          <option value="other">Other</option>
        </select>
      </div>

      {/* Actions List */}
      {displayedActions.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700">
          <CheckCircle className="w-12 h-12 text-green-600 dark:text-green-400 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400">All caught up!</p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
            No urgent actions at the moment
          </p>
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="space-y-3">
            {displayedActions.map((action, index) => {
              const timeInfo = getTimeRemaining(action.deadline);
              const Icon = action.icon;
              const CategoryIcon = getCategoryIcon(action.category);
              const categoryColor = getCategoryColor(action.category);

              return (
                <motion.div
                  key={action.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                  className={`relative rounded-xl border-2 overflow-hidden ${
                    timeInfo.expired
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800'
                      : action.completed
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-800'
                      : timeInfo.color === 'red'
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800'
                      : timeInfo.color === 'orange'
                      ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-800'
                      : 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-800'
                  }`}
                >
                  {/* Priority Stripe */}
                  {action.priority === 'critical' && !action.completed && (
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500" />
                  )}

                  <div className="p-4 pl-5">
                    <div className="flex items-start space-x-3">
                      {/* Icon */}
                      <div className={`flex-shrink-0 w-10 h-10 rounded-xl bg-${categoryColor}-500 flex items-center justify-center`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-1">
                          <h4 className={`font-semibold ${
                            action.completed
                              ? 'text-gray-500 dark:text-gray-400 line-through'
                              : 'text-gray-900 dark:text-white'
                          }`}>
                            {action.title}
                          </h4>
                          {allowDismiss && (
                            <button
                              onClick={() => handleDismiss(action.id)}
                              className="flex-shrink-0 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
                            >
                              <X className="w-4 h-4 text-gray-500" />
                            </button>
                          )}
                        </div>

                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                          {action.description}
                        </p>

                        {/* Footer */}
                        <div className="flex items-center justify-between">
                          {/* Time Remaining */}
                          <div className="flex items-center space-x-4">
                            <div className={`flex items-center space-x-1 text-sm font-medium ${
                              timeInfo.expired
                                ? 'text-red-700 dark:text-red-400'
                                : timeInfo.color === 'red'
                                ? 'text-red-700 dark:text-red-400'
                                : timeInfo.color === 'orange'
                                ? 'text-orange-700 dark:text-orange-400'
                                : 'text-green-700 dark:text-green-400'
                            }`}>
                              <Clock className="w-4 h-4" />
                              <span>{timeInfo.text}</span>
                            </div>

                            {/* Category Badge */}
                            <span className={`px-2 py-0.5 bg-${categoryColor}-100 dark:bg-${categoryColor}-900/30 text-${categoryColor}-800 dark:text-${categoryColor}-300 text-xs rounded-full font-medium capitalize`}>
                              {action.category}
                            </span>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center space-x-2">
                            {!action.completed && (
                              <>
                                <button
                                  onClick={() => handleComplete(action.id)}
                                  className="p-1.5 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition-colors"
                                  title="Mark as complete"
                                >
                                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                                </button>
                                <button
                                  onClick={() => handleAction(action)}
                                  className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                  title="Take action"
                                >
                                  <ChevronRight className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Pulsing animation for critical items */}
                  {action.priority === 'critical' && !action.completed && timeInfo.days <= 1 && (
                    <motion.div
                      animate={{ opacity: [0.3, 0.6, 0.3] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute inset-0 bg-red-500 pointer-events-none"
                      style={{ mixBlendMode: 'multiply' }}
                    />
                  )}
                </motion.div>
              );
            })}
          </div>
        </AnimatePresence>
      )}

      {/* View All Link */}
      {filteredActions.length > maxItems && (
        <button className="w-full py-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors flex items-center justify-center space-x-1">
          <span>View all {filteredActions.length} actions</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

/**
 * Compact Urgent Actions Widget
 * Smaller version for dashboard cards
 */
export function UrgentActionsCompact() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <UrgentActions maxItems={3} allowDismiss={false} />
    </div>
  );
}
