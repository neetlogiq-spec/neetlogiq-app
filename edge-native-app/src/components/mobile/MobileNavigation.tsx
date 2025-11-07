'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Menu, 
  X, 
  ChevronDown, 
  ChevronRight, 
  Home, 
  GraduationCap, 
  BookOpen, 
  BarChart3, 
  TrendingUp, 
  User, 
  Settings, 
  Search,
  Bell,
  LogOut
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: NavItem[];
}

const navigationItems: NavItem[] = [
  {
    label: 'Home',
    href: '/',
    icon: Home
  },
  {
    label: 'Colleges',
    href: '/colleges',
    icon: GraduationCap
  },
  {
    label: 'Courses',
    href: '/courses',
    icon: BookOpen
  },
  {
    label: 'Cutoffs',
    href: '/cutoffs',
    icon: BarChart3
  },
  {
    label: 'Trends',
    href: '/trends',
    icon: TrendingUp
  },
  {
    label: 'Compare',
    href: '/compare',
    icon: BarChart3
  }
];

const MobileNavigation: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const pathname = usePathname();
  const { isDarkMode } = useTheme();
  const { user, logout } = useAuth();
  const menuRef = useRef<HTMLDivElement>(null);
  
  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Close menu when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);
  
  // Handle body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);
  
  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };
  
  const toggleExpanded = (label: string) => {
    setExpandedItems(prev => 
      prev.includes(label) 
        ? prev.filter(item => item !== label)
        : [...prev, label]
    );
  };
  
  const handleLogout = async () => {
    try {
      await logout();
      setIsOpen(false);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };
  
  const renderNavItem = (item: NavItem, level = 0) => {
    const isActive = pathname === item.href;
    const isExpanded = expandedItems.includes(item.label);
    const hasChildren = item.children && item.children.length > 0;
    
    return (
      <div key={item.label} className="w-full">
        <Link
          href={item.href}
          className={`flex items-center justify-between px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
            isActive
              ? isDarkMode 
                ? 'bg-blue-600 text-white' 
                : 'bg-blue-500 text-white'
              : isDarkMode
                ? 'text-gray-300 hover:bg-white/10 hover:text-white'
                : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
          }`}
          style={{ paddingLeft: `${level * 16 + 16}px` }}
          onClick={() => {
            if (hasChildren) {
              toggleExpanded(item.label);
            }
          }}
        >
          <div className="flex items-center gap-3">
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </div>
          
          {hasChildren && (
            <motion.div
              animate={{ rotate: isExpanded ? 90 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronRight className="w-4 h-4" />
            </motion.div>
          )}
        </Link>
        
        {hasChildren && (
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-1 space-y-1">
                  {item.children.map(child => renderNavItem(child, level + 1))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    );
  };
  
  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={toggleMenu}
        className={`lg:hidden p-2 rounded-lg transition-colors ${
          isDarkMode 
            ? 'text-gray-300 hover:bg-white/10' 
            : 'text-gray-700 hover:bg-gray-100'
        }`}
        aria-label="Toggle navigation menu"
      >
        <Menu className="w-6 h-6" />
      </button>
      
      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={`fixed inset-0 z-40 lg:hidden ${
                isDarkMode ? 'bg-black/50' : 'bg-black/30'
              }`}
              onClick={toggleMenu}
            />
            
            {/* Menu Panel */}
            <motion.div
              ref={menuRef}
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={`fixed top-0 left-0 bottom-0 w-80 z-50 lg:hidden ${
                isDarkMode ? 'bg-gray-900' : 'bg-white'
              } shadow-xl overflow-hidden flex flex-col`}
            >
              {/* Header */}
              <div className={`flex items-center justify-between p-4 border-b ${
                isDarkMode ? 'border-gray-800' : 'border-gray-200'
              }`}>
                <h2 className={`text-lg font-semibold ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  Menu
                </h2>
                <button
                  onClick={toggleMenu}
                  className={`p-2 rounded-lg transition-colors ${
                    isDarkMode 
                      ? 'text-gray-400 hover:bg-white/10 hover:text-white' 
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                  aria-label="Close navigation menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Navigation Items */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {navigationItems.map(item => renderNavItem(item))}
                
                {/* User Section */}
                <div className={`pt-4 mt-4 border-t ${
                  isDarkMode ? 'border-gray-800' : 'border-gray-200'
                }`}>
                  {user ? (
                    <>
                      <Link
                        href="/dashboard"
                        className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                          isDarkMode
                            ? 'text-gray-300 hover:bg-white/10 hover:text-white'
                            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                        }`}
                      >
                        <User className="w-5 h-5" />
                        <span>Dashboard</span>
                      </Link>
                      
                      <Link
                        href="/settings"
                        className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                          isDarkMode
                            ? 'text-gray-300 hover:bg-white/10 hover:text-white'
                            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                        }`}
                      >
                        <Settings className="w-5 h-5" />
                        <span>Settings</span>
                      </Link>
                      
                      <button
                        onClick={handleLogout}
                        className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors w-full text-left ${
                          isDarkMode
                            ? 'text-red-400 hover:bg-red-900/20 hover:text-red-300'
                            : 'text-red-600 hover:bg-red-50 hover:text-red-700'
                        }`}
                      >
                        <LogOut className="w-5 h-5" />
                        <span>Logout</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/login"
                        className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                          isDarkMode
                            ? 'text-gray-300 hover:bg-white/10 hover:text-white'
                            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                        }`}
                      >
                        <User className="w-5 h-5" />
                        <span>Login</span>
                      </Link>
                      
                      <Link
                        href="/signup"
                        className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                          isDarkMode
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'bg-blue-500 text-white hover:bg-blue-600'
                        }`}
                      >
                        <User className="w-5 h-5" />
                        <span>Sign Up</span>
                      </Link>
                    </>
                  )}
                </div>
              </div>
              
              {/* Footer */}
              <div className={`p-4 border-t ${
                isDarkMode ? 'border-gray-800' : 'border-gray-200'
              }`}>
                <div className="flex items-center justify-between">
                  <Link
                    href="/search"
                    className={`p-2 rounded-lg transition-colors ${
                      isDarkMode
                        ? 'text-gray-400 hover:bg-white/10 hover:text-white'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                    aria-label="Search"
                  >
                    <Search className="w-5 h-5" />
                  </Link>
                  
                  <Link
                    href="/notifications"
                    className={`p-2 rounded-lg transition-colors relative ${
                      isDarkMode
                        ? 'text-gray-400 hover:bg-white/10 hover:text-white'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                    aria-label="Notifications"
                  >
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                  </Link>
                  
                  <button
                    className={`p-2 rounded-lg transition-colors ${
                      isDarkMode
                        ? 'text-gray-400 hover:bg-white/10 hover:text-white'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                    onClick={() => {
                      // Toggle theme
                      document.documentElement.classList.toggle('dark');
                    }}
                    aria-label="Toggle theme"
                  >
                    <div className="w-5 h-5 relative">
                      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500"></div>
                      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 opacity-0 dark:opacity-100"></div>
                    </div>
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default MobileNavigation;

