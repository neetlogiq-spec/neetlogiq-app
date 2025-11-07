'use client';

import React, { useState, useEffect } from 'react';
import { Bell, X, Check, AlertCircle, Info, CheckCircle } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import userPreferences from '@/services/userPreferences';
import { Notification } from '@/types/user';

interface NotificationCenterProps {
  className?: string;
}

export default function NotificationCenter({ className = '' }: NotificationCenterProps) {
  const { isDarkMode } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const preferences = userPreferences.getPreferences();
    setNotifications(preferences.notifications);
    setUnreadCount(preferences.notifications.filter(n => !n.read).length);
  }, []);

  const handleMarkAsRead = (notificationId: string) => {
    userPreferences.markNotificationAsRead(notificationId);
    const updatedNotifications = notifications.map(n => 
      n.id === notificationId ? { ...n, read: true } : n
    );
    setNotifications(updatedNotifications);
    setUnreadCount(updatedNotifications.filter(n => !n.read).length);
  };

  const handleMarkAllAsRead = () => {
    userPreferences.markAllNotificationsAsRead();
    const updatedNotifications = notifications.map(n => ({ ...n, read: true }));
    setNotifications(updatedNotifications);
    setUnreadCount(0);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'cutoff_update':
        return AlertCircle;
      case 'deadline':
        return AlertCircle;
      case 'new_college':
        return Info;
      case 'recommendation':
        return CheckCircle;
      case 'watchlist_alert':
        return Bell;
      default:
        return Info;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'cutoff_update':
        return isDarkMode ? 'text-orange-400' : 'text-orange-500';
      case 'deadline':
        return isDarkMode ? 'text-red-400' : 'text-red-500';
      case 'new_college':
        return isDarkMode ? 'text-blue-400' : 'text-blue-500';
      case 'recommendation':
        return isDarkMode ? 'text-green-400' : 'text-green-500';
      case 'watchlist_alert':
        return isDarkMode ? 'text-purple-400' : 'text-purple-500';
      default:
        return isDarkMode ? 'text-white/60' : 'text-gray-500';
    }
  };

  const formatTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - timestamp.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  return (
    <div className={`relative ${className}`}>
      {/* Notification Bell */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-full transition-colors ${
          isDarkMode 
            ? 'hover:bg-white/10 text-white' 
            : 'hover:bg-gray-100 text-gray-700'
        }`}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown */}
      {isOpen && (
        <div className={`absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto rounded-lg shadow-lg border z-50 ${
          isDarkMode 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-200'
        }`}>
          {/* Header */}
          <div className={`p-4 border-b ${
            isDarkMode ? 'border-gray-700' : 'border-gray-200'
          }`}>
            <div className="flex items-center justify-between">
              <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Notifications
              </h3>
              <div className="flex items-center space-x-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className={`text-xs px-2 py-1 rounded transition-colors ${
                      isDarkMode 
                        ? 'text-blue-400 hover:bg-white/10' 
                        : 'text-blue-600 hover:bg-gray-100'
                    }`}
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className={`p-1 rounded transition-colors ${
                    isDarkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100'
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length > 0 ? (
              notifications.slice(0, 10).map((notification) => {
                const IconComponent = getNotificationIcon(notification.type);
                const iconColor = getNotificationColor(notification.type);
                
                return (
                  <div
                    key={notification.id}
                    className={`p-4 border-b transition-colors ${
                      isDarkMode 
                        ? 'border-gray-700 hover:bg-white/5' 
                        : 'border-gray-200 hover:bg-gray-50'
                    } ${!notification.read ? (isDarkMode ? 'bg-white/5' : 'bg-blue-50') : ''}`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className={`p-1 rounded-full ${isDarkMode ? 'bg-white/10' : 'bg-gray-100'}`}>
                        <IconComponent className={`w-3 h-3 ${iconColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {notification.title}
                        </div>
                        <div className={`text-xs ${isDarkMode ? 'text-white/70' : 'text-gray-600'} mt-1`}>
                          {notification.message}
                        </div>
                        <div className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-400'} mt-1`}>
                          {formatTimeAgo(notification.createdAt)}
                        </div>
                      </div>
                      {!notification.read && (
                        <button
                          onClick={() => handleMarkAsRead(notification.id)}
                          className={`p-1 rounded transition-colors ${
                            isDarkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100'
                          }`}
                          title="Mark as read"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className={`p-8 text-center ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>
                <Bell className={`w-8 h-8 mx-auto mb-2 ${isDarkMode ? 'text-white/40' : 'text-gray-400'}`} />
                <p className="text-sm">No notifications yet</p>
                <p className="text-xs mt-1">We'll notify you about important updates!</p>
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 10 && (
            <div className={`p-3 text-center border-t ${
              isDarkMode ? 'border-gray-700' : 'border-gray-200'
            }`}>
              <button className={`text-xs ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
