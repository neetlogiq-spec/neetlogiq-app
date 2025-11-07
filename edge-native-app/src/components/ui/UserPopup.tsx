"use client";

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface UserPopupProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onLogout: () => void;
}

const UserPopup: React.FC<UserPopupProps> = ({ isOpen, onClose, user, onLogout }) => {
  const popupRef = useRef<HTMLDivElement>(null);

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
        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
          <User size={16} className="text-white" />
        </div>
        <span className="text-sm font-medium">{user.displayName || user.email}</span>
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
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                  <User size={20} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user.displayName || 'User'}
                  </p>
                  <p className="text-xs text-gray-600 truncate">
                    {user.email}
                  </p>
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