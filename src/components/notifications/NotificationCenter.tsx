'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, 
  X, 
  Check, 
  AlertTriangle, 
  Info, 
  Settings, 
  Trash2,
  Clock,
  User,
  Eye,
  EyeOff,
  Volume2,
  VolumeX
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useDataCache } from '@/hooks/useDataCache';
import { supabase } from '@/lib/supabase';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: number;
  read: boolean;
  priority: 'low' | 'medium' | 'high';
  actionUrl?: string;
  actionText?: string;
  icon?: React.ReactNode;
  persistent?: boolean;
  metadata?: Record<string, any>;
}

interface NotificationCenterProps {
  className?: string;
  maxNotifications?: number;
  enableSound?: boolean;
  enableDesktop?: boolean;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({
  className = '',
  maxNotifications = 10,
  enableSound = true,
  enableDesktop = true
}) => {
  const { isDarkMode } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const { getCachedData } = useDataCache<Notification[]>();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(enableSound);
  const [desktopEnabled, setDesktopEnabled] = useState(enableDesktop);
  const [showSettings, setShowSettings] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationRef = useRef<HTMLDivElement>(null);
  
  // Request desktop notification permission
  useEffect(() => {
    if (enableDesktop && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [enableDesktop]);
  
  // Fetch notifications from server
  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    
    try {
      const data = await getCachedData(
        'notifications',
        async () => {
          const response = await fetch('/api/notifications');
          if (!response.ok) throw new Error('Failed to fetch notifications');
          const json = await response.json();
          return json.data.notifications.map((n: any) => ({
            id: n.id,
            title: n.title,
            message: n.message,
            type: n.type === 'system' ? 'info' : n.type,
            timestamp: new Date(n.created_at).getTime(),
            read: n.read, // API returns 'read' now
            priority: n.priority || 'medium',
            actionUrl: n.link, // API returns 'link'
            persistent: false
          }));
        },
        { ttl: 30 * 1000 } // 30 seconds cache
      );
      
      setNotifications(data.slice(0, maxNotifications));
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  }, [isAuthenticated, getCachedData, maxNotifications]);
  
  // Initial fetch and periodic updates
  useEffect(() => {
    fetchNotifications();
    
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);
  
  // Update unread count
  useEffect(() => {
    const unread = notifications.filter(n => !n.read).length;
    setUnreadCount(unread);
  }, [notifications]);
  
  // Play notification sound
  const playNotificationSound = useCallback((type: Notification['type']) => {
    if (!soundEnabled) return;
    
    const audio = new Audio();
    switch (type) {
      case 'success':
        audio.src = '/sounds/success.mp3';
        break;
      case 'warning':
        audio.src = '/sounds/warning.mp3';
        break;
      case 'error':
        audio.src = '/sounds/error.mp3';
        break;
      default:
        audio.src = '/sounds/notification.mp3';
    }
    
    audio.volume = 0.3;
    audio.play().catch(() => {
      // Ignore errors (user might have blocked autoplay)
    });
  }, [soundEnabled]);
  
  // Show desktop notification
  const showDesktopNotification = useCallback((notification: Notification) => {
    if (!desktopEnabled || !('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }
    
    const notificationOptions: NotificationOptions = {
      body: notification.message,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: notification.id,
      requireInteraction: notification.persistent || notification.type === 'error'
    };
    
    const desktopNotification = new Notification(notification.title, notificationOptions);
    
    // Auto close after 5 seconds for non-persistent notifications
    if (!notification.persistent) {
      setTimeout(() => {
        desktopNotification.close();
      }, 5000);
    }
    
    // Handle click
    desktopNotification.onclick = () => {
      if (notification.actionUrl) {
        window.open(notification.actionUrl, '_blank');
      }
      desktopNotification.close();
    };
  }, [desktopEnabled]);
  
  // Add new notification
  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const newNotification: Notification = {
      ...notification,
      id: `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      read: false
    };
    
    setNotifications(prev => {
      const updated = [newNotification, ...prev].slice(0, maxNotifications);
      return updated;
    });
    
    // Play sound
    playNotificationSound(notification.type);
    
    // Show desktop notification
    showDesktopNotification(newNotification);
    
    return newNotification;
  }, [maxNotifications, playNotificationSound, showDesktopNotification]);
  
  // Real-time updates
  useEffect(() => {
    if (!user?.uid) return;

    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.uid}`
        },
        (payload) => {
          const newNotification = payload.new as any;
          
          // Add to state
          setNotifications(prev => {
            const notification: Notification = {
              id: newNotification.id,
              title: newNotification.title,
              message: newNotification.message,
              type: newNotification.type === 'system' ? 'info' : newNotification.type, // Map types if needed
              timestamp: new Date(newNotification.created_at).getTime(),
              read: false,
              priority: newNotification.priority || 'medium',
              actionUrl: newNotification.link, // Map link to actionUrl
              persistent: false
            };
            
            // Play sound
            playNotificationSound(notification.type);
            
            // Show desktop notification
            showDesktopNotification(notification);
            
            return [notification, ...prev].slice(0, maxNotifications);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.uid, maxNotifications, playNotificationSound, showDesktopNotification]);

  // Mark notification as read
  const markAsRead = useCallback(async (id: string) => {
    try {
      await fetch('/api/notifications/mark-read', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_id: id })
      });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
    
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  }, []);
  
  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      await fetch('/api/notifications/mark-read', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mark_all: true })
      });
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
    
    setNotifications(prev => 
      prev.map(n => ({ ...n, read: true }))
    );
  }, []);
  
  // Delete notification
  const deleteNotification = useCallback(async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
    
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);
  
  // Clear all notifications
  const clearAllNotifications = useCallback(async () => {
    try {
      await fetch('/api/notifications', { method: 'DELETE' });
    } catch (error) {
      console.error('Failed to clear notifications:', error);
    }
    
    setNotifications([]);
  }, []);
  
  // Get notification icon
  const getNotificationIcon = (type: Notification['type'], icon?: React.ReactNode) => {
    if (icon) return icon;
    
    switch (type) {
      case 'success':
        return <Check className="w-5 h-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'error':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };
  
  // Get notification color
  const getNotificationColor = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return isDarkMode ? 'bg-green-900/20 border-green-800/30' : 'bg-green-50 border-green-200';
      case 'warning':
        return isDarkMode ? 'bg-yellow-900/20 border-yellow-800/30' : 'bg-yellow-50 border-yellow-200';
      case 'error':
        return isDarkMode ? 'bg-red-900/20 border-red-800/30' : 'bg-red-50 border-red-200';
      default:
        return isDarkMode ? 'bg-blue-900/20 border-blue-800/30' : 'bg-blue-50 border-blue-200';
    }
  };
  
  // Format timestamp
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowSettings(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  return (
    <div className={`relative ${className}`}>
      {/* Notification Bell */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-lg transition-colors ${
          isDarkMode 
            ? 'text-gray-400 hover:bg-white/10 hover:text-white' 
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
        aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
      >
        <Bell className="w-5 h-5" />
        
        {/* Unread indicator */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      
      {/* Notification Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={notificationRef}
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.2 }}
            className={`absolute right-0 mt-2 w-96 max-h-96 rounded-lg shadow-lg border z-50 overflow-hidden ${
              isDarkMode 
                ? 'bg-gray-900 border-gray-700' 
                : 'bg-white border-gray-200'
            }`}
          >
            {/* Header */}
            <div className={`flex items-center justify-between p-4 border-b ${
              isDarkMode ? 'border-gray-700' : 'border-gray-200'
            }`}>
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Notifications
                </h3>
                {unreadCount > 0 && (
                  <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    ({unreadCount} unread)
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-1">
                {/* Mark all as read */}
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className={`p-1 rounded transition-colors ${
                      isDarkMode 
                        ? 'text-gray-400 hover:bg-white/10 hover:text-white' 
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                    title="Mark all as read"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                )}
                
                {/* Settings */}
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={`p-1 rounded transition-colors ${
                    isDarkMode 
                      ? 'text-gray-400 hover:bg-white/10 hover:text-white' 
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                  title="Settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {/* Settings Panel */}
            <AnimatePresence>
              {showSettings && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`p-4 border-b ${
                    isDarkMode ? 'border-gray-700' : 'border-gray-200'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Sound Toggle */}
                    <div className="flex items-center justify-between">
                      <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Sound
                      </span>
                      <button
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        className={`p-1 rounded transition-colors ${
                          soundEnabled
                            ? 'text-blue-500'
                            : isDarkMode 
                              ? 'text-gray-400' 
                              : 'text-gray-600'
                        }`}
                      >
                        {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                      </button>
                    </div>
                    
                    {/* Desktop Toggle */}
                    <div className="flex items-center justify-between">
                      <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Desktop
                      </span>
                      <button
                        onClick={() => setDesktopEnabled(!desktopEnabled)}
                        className={`p-1 rounded transition-colors ${
                          desktopEnabled
                            ? 'text-blue-500'
                            : isDarkMode 
                              ? 'text-gray-400' 
                              : 'text-gray-600'
                        }`}
                      >
                        {desktopEnabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                    </div>
                    
                    {/* Clear All */}
                    <button
                      onClick={clearAllNotifications}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        isDarkMode 
                          ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30 hover:text-red-300' 
                          : 'bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700'
                      }`}
                    >
                      <Trash2 className="w-4 h-4" />
                      Clear All
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* Notifications List */}
            <div className="max-h-64 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className={`w-12 h-12 mx-auto mb-4 ${
                    isDarkMode ? 'text-gray-600' : 'text-gray-400'
                  }`} />
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    No notifications yet
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {notifications.map((notification) => (
                    <motion.div
                      key={notification.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className={`p-4 transition-colors ${
                        notification.read 
                          ? isDarkMode ? 'bg-gray-800/50' : 'bg-gray-50'
                          : getNotificationColor(notification.type)
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className="flex-shrink-0 mt-1">
                          {getNotificationIcon(notification.type, notification.icon)}
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <h4 className={`text-sm font-medium ${
                              notification.read 
                                ? isDarkMode ? 'text-gray-400' : 'text-gray-600'
                                : isDarkMode ? 'text-white' : 'text-gray-900'
                            }`}>
                              {notification.title}
                            </h4>
                            
                            {/* Actions */}
                            <div className="flex items-center gap-1">
                              {!notification.read && (
                                <button
                                  onClick={() => markAsRead(notification.id)}
                                  className={`p-1 rounded transition-colors ${
                                    isDarkMode 
                                      ? 'text-gray-400 hover:bg-white/10 hover:text-white' 
                                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                  }`}
                                  title="Mark as read"
                                >
                                  <Eye className="w-3 h-3" />
                                </button>
                              )}
                              
                              <button
                                onClick={() => deleteNotification(notification.id)}
                                className={`p-1 rounded transition-colors ${
                                  isDarkMode 
                                    ? 'text-gray-400 hover:bg-white/10 hover:text-white' 
                                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                }`}
                                title="Delete"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          
                          {/* Message */}
                          <p className={`text-sm mt-1 ${
                            notification.read 
                              ? isDarkMode ? 'text-gray-500' : 'text-gray-600'
                              : isDarkMode ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            {notification.message}
                          </p>
                          
                          {/* Action Button */}
                          {notification.actionUrl && (
                            <a
                              href={notification.actionUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`inline-flex items-center gap-1 mt-2 px-3 py-1 rounded text-xs font-medium transition-colors ${
                                isDarkMode 
                                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                                  : 'bg-blue-500 text-white hover:bg-blue-600'
                              }`}
                            >
                              {notification.actionText || 'View Details'}
                            </a>
                          )}
                          
                          {/* Timestamp */}
                          <div className="flex items-center gap-1 mt-2">
                            <Clock className={`w-3 h-3 ${
                              isDarkMode ? 'text-gray-500' : 'text-gray-400'
                            }`} />
                            <span className={`text-xs ${
                              isDarkMode ? 'text-gray-500' : 'text-gray-400'
                            }`}>
                              {formatTimestamp(notification.timestamp)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Hook for sending notifications (can be used globally)
export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  const sendNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const newNotification: Notification = {
      ...notification,
      id: `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      read: false
    };
    
    setNotifications(prev => [newNotification, ...prev]);
    
    // Show desktop notification
    if ('Notification' in window && Notification.permission === 'granted') {
      const notificationOptions: NotificationOptions = {
        body: notification.message,
        icon: '/favicon.ico',
        tag: newNotification.id
      };
      
      new Notification(notification.title, notificationOptions);
    }
    
    return newNotification;
  }, []);
  
  return { sendNotification, notifications };
};

export default NotificationCenter;

