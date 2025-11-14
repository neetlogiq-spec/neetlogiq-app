'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, CheckCircle2, AlertCircle, Bell } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { showSuccess } from '@/lib/toast';

interface ImportantDate {
  id: string;
  title: string;
  date: string;
  endDate?: string;
  description: string;
  status: 'completed' | 'ongoing' | 'upcoming';
  category: string;
}

interface ImportantDatesProps {
  dates: ImportantDate[];
  counsellingBody: string;
}

const ImportantDates: React.FC<ImportantDatesProps> = ({ dates, counsellingBody }) => {
  const { isDarkMode } = useTheme();
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'completed'>('all');

  const filteredDates = dates.filter(date => {
    if (filter === 'all') return true;
    return date.status === filter;
  });

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      registration: 'from-blue-500 to-cyan-500',
      allotment: 'from-purple-500 to-pink-500',
      verification: 'from-green-500 to-teal-500',
      payment: 'from-orange-500 to-red-500',
      other: 'from-gray-500 to-gray-600'
    };
    return colors[category] || colors.other;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'ongoing':
        return <Clock className="w-5 h-5 text-orange-500 animate-pulse" />;
      case 'upcoming':
        return <AlertCircle className="w-5 h-5 text-blue-500" />;
      default:
        return null;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleSetReminder = (date: ImportantDate) => {
    // Implement reminder functionality
    showSuccess(`Reminder set for ${date.title}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className={`text-2xl font-bold ${
          isDarkMode ? 'text-white' : 'text-gray-900'
        }`}>
          Important Dates Timeline
        </h2>

        {/* Filter Buttons */}
        <div className={`backdrop-blur-sm rounded-lg p-1 border ${
          isDarkMode
            ? 'bg-white/5 border-white/10'
            : 'bg-gray-100/50 border-gray-200'
        }`}>
          <div className="flex gap-1">
            {['all', 'upcoming', 'completed'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f as any)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-300 ${
                  filter === f
                    ? isDarkMode
                      ? 'bg-white/20 text-white'
                      : 'bg-gray-900 text-white'
                    : isDarkMode
                      ? 'text-gray-400 hover:text-white'
                      : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical Line */}
        <div className={`absolute left-8 top-0 bottom-0 w-0.5 ${
          isDarkMode ? 'bg-gradient-to-b from-white/20 to-white/5' : 'bg-gradient-to-b from-gray-300 to-gray-100'
        }`}></div>

        {/* Timeline Items */}
        <div className="space-y-6">
          {filteredDates.map((date, index) => (
            <motion.div
              key={date.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="relative pl-20"
            >
              {/* Timeline Dot */}
              <div className="absolute left-0 top-0 flex items-center">
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${getCategoryColor(date.category)} flex items-center justify-center shadow-lg`}>
                  <Calendar className="w-8 h-8 text-white" />
                </div>
              </div>

              {/* Content Card */}
              <div className={`backdrop-blur-sm rounded-xl border p-6 transition-all duration-300 hover:scale-[1.02] ${
                isDarkMode
                  ? 'bg-white/5 border-white/10 hover:bg-white/10'
                  : 'bg-white/60 border-gray-200 hover:bg-white/80'
              }`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusIcon(date.status)}
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        date.status === 'completed'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : date.status === 'ongoing'
                          ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      }`}>
                        {date.status.toUpperCase()}
                      </span>
                    </div>
                    <h3 className={`text-lg font-semibold mb-1 ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      {date.title}
                    </h3>
                    <p className={`text-sm ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {date.description}
                    </p>
                  </div>

                  <button
                    onClick={() => handleSetReminder(date)}
                    className={`p-2 rounded-lg transition-colors ${
                      isDarkMode
                        ? 'hover:bg-white/10 text-gray-400'
                        : 'hover:bg-gray-100 text-gray-600'
                    }`}
                    title="Set Reminder"
                  >
                    <Bell className="w-5 h-5" />
                  </button>
                </div>

                {/* Date Range */}
                <div className="flex items-center gap-4 text-sm">
                  <div className={`flex items-center gap-2 ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    <Clock className="w-4 h-4" />
                    <span className="font-medium">{formatDate(date.date)}</span>
                    {date.endDate && (
                      <>
                        <span>to</span>
                        <span className="font-medium">{formatDate(date.endDate)}</span>
                      </>
                    )}
                  </div>

                  <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                    isDarkMode ? 'bg-white/10 text-gray-300' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {date.category.charAt(0).toUpperCase() + date.category.slice(1)}
                  </span>
                </div>

                {/* Days Remaining (for upcoming events) */}
                {date.status === 'upcoming' && (
                  <div className={`mt-3 pt-3 border-t ${
                    isDarkMode ? 'border-white/10' : 'border-gray-200'
                  }`}>
                    <p className={`text-xs ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {Math.ceil((new Date(date.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days remaining
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Empty State */}
      {filteredDates.length === 0 && (
        <div className={`text-center py-12 ${
          isDarkMode ? 'text-gray-400' : 'text-gray-600'
        }`}>
          <Calendar className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>No {filter !== 'all' ? filter : ''} dates found</p>
        </div>
      )}
    </div>
  );
};

export default ImportantDates;
