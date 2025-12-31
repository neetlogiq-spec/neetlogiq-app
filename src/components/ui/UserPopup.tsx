"use client";

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, LogOut, ChevronDown, Crown, Zap, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePremium } from '@/contexts/PremiumContext';
import { PRICING_PLANS } from '@/config/premium';
import Link from 'next/link';

interface UserPopupProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onLogout: () => void;
}

const UserPopup: React.FC<UserPopupProps> = ({ isOpen, onClose, user, onLogout }) => {
  const popupRef = useRef<HTMLDivElement>(null);
  const { isPremium, subscriptionTier, subscriptionEndDate } = usePremium();
  const { isSuperAdmin } = useAuth();
  const currentPlanObj = PRICING_PLANS[subscriptionTier] || PRICING_PLANS.free;

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!user) return null;

  return (
    <div className="relative" ref={popupRef}>
      {/* User Button */}
      <button
        onClick={() => onClose()}
        className="flex items-center space-x-2 px-3 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center overflow-hidden">
          {user.photoURL ? (
            <img src={user.photoURL} alt={user.displayName || 'User'} className="w-full h-full object-cover" />
          ) : (
            <User size={16} className="text-white" />
          )}
        </div>
        <span className="text-sm font-medium">{user.givenName || user.displayName || user.email?.split('@')[0]}</span>
        <ChevronDown size={16} />
      </button>

      {/* Popup Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-50"
          >
            {/* User Info */}
            <div className="p-4 border-b border-gray-200/50">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center overflow-hidden">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName || 'User'} className="w-full h-full object-cover" />
                  ) : (
                    <User size={20} className="text-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {user.displayName || user.name || 'User'}
                    </p>
                    {isSuperAdmin && (
                      <span className="px-1.5 py-0.5 bg-linear-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-bold rounded flex items-center gap-1 shadow-sm border border-white/20">
                        <Shield className="w-2.5 h-2.5" />
                        SUPER ADMIN
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                    {user.email}
                  </p>
                </div>
              </div>
            </div>

            {/* Plan Status */}
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50">
              <div className={`p-3 rounded-lg border-2 ${
                isSuperAdmin 
                  ? 'bg-linear-to-br from-blue-500/10 to-indigo-500/10 border-blue-500/20'
                  : isPremium 
                    ? 'bg-linear-to-br from-purple-500/10 to-blue-500/10 border-purple-500/20' 
                    : 'bg-gray-100 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Current Status
                  </span>
                  {isSuperAdmin ? (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 bg-linear-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-bold rounded shadow-sm">
                      <Shield className="w-2.5 h-2.5" />
                      ADMIN
                    </div>
                  ) : isPremium && (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 bg-yellow-400 text-gray-900 text-[10px] font-bold rounded shadow-sm">
                      <Crown className="w-2.5 h-2.5" />
                      PRO
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${
                    isSuperAdmin 
                      ? 'bg-blue-100 text-blue-600'
                      : isPremium 
                        ? 'bg-purple-100 text-purple-600' 
                        : 'bg-gray-200 text-gray-600'
                  }`}>
                    {isSuperAdmin ? <Shield className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white leading-none mb-1">
                      {isSuperAdmin ? 'Super Admin' : currentPlanObj.displayName}
                    </h4>
                    {isSuperAdmin ? (
                      <p className="text-[10px] text-blue-600 font-semibold">
                        Unrestricted Developer Access
                      </p>
                    ) : !isPremium ? (
                      <Link 
                        href="/pricing"
                        onClick={onClose}
                        className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 group"
                      >
                        Upgrade Now
                        <Sparkles className="w-3 h-3 group-hover:animate-pulse" />
                      </Link>
                    ) : (
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">
                        Active until {subscriptionEndDate ? new Date(subscriptionEndDate).toLocaleDateString() : 'N/A'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="py-2">
              <button
                onClick={() => {
                  onLogout();
                  onClose();
                }}
                className="w-full flex items-center space-x-3 px-4 py-3 text-left text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut size={16} />
                <span className="text-sm font-medium">Sign Out</span>
              </button>
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-gray-200/50">
              <p className="text-xs text-gray-500 text-center">
                NeetLogIQ Account
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UserPopup;