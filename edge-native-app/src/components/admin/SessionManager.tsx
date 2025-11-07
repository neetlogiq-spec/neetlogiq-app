'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  AlertTriangle,
  LogOut,
  RefreshCw,
  Shield,
  Activity,
  X,
  Timer
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { logAdminAction, updateSessionActivity } from '@/services/adminAuditLog';

interface SessionManagerProps {
  timeoutMinutes?: number;
  warningMinutes?: number;
  onSessionExpired?: () => void;
  onSessionWarning?: (remainingMinutes: number) => void;
}

interface SessionWarningModalProps {
  isOpen: boolean;
  remainingTime: number;
  onExtend: () => void;
  onLogout: () => void;
}

const SessionWarningModal: React.FC<SessionWarningModalProps> = ({
  isOpen,
  remainingTime,
  onExtend,
  onLogout
}) => {
  if (!isOpen) return null;

  const minutes = Math.floor(remainingTime / 60);
  const seconds = remainingTime % 60;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full"
        >
          <div className="p-6">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/20 rounded-full flex items-center justify-center">
                <Timer className="w-8 h-8 text-amber-600" />
              </div>
            </div>
            
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white text-center mb-2">
              Session Timeout Warning
            </h2>
            
            <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
              Your admin session will expire in:
            </p>
            
            <div className="text-center mb-6">
              <div className="text-3xl font-bold text-amber-600 mb-2">
                {minutes}:{seconds.toString().padStart(2, '0')}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                You will be automatically logged out for security
              </p>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={onLogout}
                className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 flex items-center justify-center"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout Now
              </button>
              <button
                onClick={onExtend}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 flex items-center justify-center"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Extend Session
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

const SessionManager: React.FC<SessionManagerProps> = ({
  timeoutMinutes = 30, // 30 minutes default for admin sessions
  warningMinutes = 5,  // Show warning 5 minutes before expiry
  onSessionExpired,
  onSessionWarning
}) => {
  const { user, signOut } = useAuth();
  const [sessionStartTime, setSessionStartTime] = useState<Date>(new Date());
  const [lastActivityTime, setLastActivityTime] = useState<Date>(new Date());
  const [showWarning, setShowWarning] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);
  const [sessionId] = useState(`session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);

  // Update last activity time
  const updateActivity = useCallback(() => {
    const now = new Date();
    setLastActivityTime(now);
    
    if (user) {
      updateSessionActivity(sessionId, 'activity_update');
      logAdminAction(user.uid, user.email!, 'session_activity', {
        sessionId,
        details: { timestamp: now.toISOString() }
      });
    }
  }, [user, sessionId]);

  // Check session timeout
  useEffect(() => {
    const checkSessionTimeout = () => {
      const now = new Date();
      const timeSinceActivity = (now.getTime() - lastActivityTime.getTime()) / 1000 / 60; // in minutes
      const timeUntilTimeout = timeoutMinutes - timeSinceActivity;
      
      if (timeUntilTimeout <= 0) {
        // Session expired
        handleSessionExpired();
      } else if (timeUntilTimeout <= warningMinutes && !showWarning) {
        // Show warning
        setShowWarning(true);
        setRemainingTime(Math.floor(timeUntilTimeout * 60)); // Convert to seconds
        onSessionWarning?.(timeUntilTimeout);
      }
      
      if (showWarning && timeUntilTimeout > warningMinutes) {
        // Hide warning if session was extended
        setShowWarning(false);
      }
    };

    const interval = setInterval(checkSessionTimeout, 1000); // Check every second
    return () => clearInterval(interval);
  }, [lastActivityTime, timeoutMinutes, warningMinutes, showWarning, onSessionWarning]);

  // Update remaining time countdown
  useEffect(() => {
    if (!showWarning) return;

    const updateCountdown = () => {
      const now = new Date();
      const timeSinceActivity = (now.getTime() - lastActivityTime.getTime()) / 1000 / 60;
      const timeUntilTimeout = Math.max(0, timeoutMinutes - timeSinceActivity);
      setRemainingTime(Math.floor(timeUntilTimeout * 60));
      
      if (timeUntilTimeout <= 0) {
        handleSessionExpired();
      }
    };

    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [showWarning, lastActivityTime, timeoutMinutes]);

  // Handle session expiration
  const handleSessionExpired = useCallback(() => {
    if (user) {
      logAdminAction(user.uid, user.email!, 'session_expired', {
        sessionId,
        details: { 
          reason: 'timeout',
          durationMinutes: timeoutMinutes,
          expiredAt: new Date().toISOString()
        }
      });
    }
    
    setShowWarning(false);
    onSessionExpired?.();
    signOut();
  }, [user, sessionId, timeoutMinutes, onSessionExpired, signOut]);

  // Handle session extension
  const handleExtendSession = useCallback(() => {
    updateActivity();
    setShowWarning(false);
    
    if (user) {
      logAdminAction(user.uid, user.email!, 'session_extended', {
        sessionId,
        details: { 
          extendedAt: new Date().toISOString(),
          previousActivity: lastActivityTime.toISOString()
        }
      });
    }
  }, [updateActivity, user, sessionId, lastActivityTime]);

  // Handle manual logout
  const handleLogout = useCallback(() => {
    if (user) {
      logAdminAction(user.uid, user.email!, 'manual_logout', {
        sessionId,
        details: { 
          loggedOutAt: new Date().toISOString(),
          sessionDuration: Math.floor((Date.now() - sessionStartTime.getTime()) / 1000 / 60)
        }
      });
    }
    
    setShowWarning(false);
    signOut();
  }, [user, sessionId, sessionStartTime, signOut]);

  // Set up activity listeners
  useEffect(() => {
    const activityEvents = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click'
    ];

    const throttledUpdateActivity = throttle(updateActivity, 30000); // Throttle to once per 30 seconds

    activityEvents.forEach(event => {
      document.addEventListener(event, throttledUpdateActivity, true);
    });

    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, throttledUpdateActivity, true);
      });
    };
  }, [updateActivity]);

  // Initialize session
  useEffect(() => {
    if (user) {
      const now = new Date();
      setSessionStartTime(now);
      setLastActivityTime(now);
      
      logAdminAction(user.uid, user.email!, 'session_started', {
        sessionId,
        details: { 
          startTime: now.toISOString(),
          timeoutMinutes,
          warningMinutes
        }
      });
    }
  }, [user, sessionId, timeoutMinutes, warningMinutes]);

  // Don't render anything if user is not logged in
  if (!user) return null;

  return (
    <>
      {/* Session Status Indicator (optional - can be shown in admin header) */}
      <div className="hidden">
        <div className="flex items-center space-x-2 text-xs text-gray-500">
          <Activity className="w-3 h-3" />
          <span>Session: {Math.floor((Date.now() - sessionStartTime.getTime()) / 1000 / 60)}m</span>
        </div>
      </div>

      {/* Session Warning Modal */}
      <SessionWarningModal
        isOpen={showWarning}
        remainingTime={remainingTime}
        onExtend={handleExtendSession}
        onLogout={handleLogout}
      />
    </>
  );
};

// Throttle utility function
function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return function(this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

export default SessionManager;