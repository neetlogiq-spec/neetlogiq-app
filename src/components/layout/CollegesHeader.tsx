"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  GraduationCap, 
  Home, 
  BookOpen, 
  TrendingUp, 
  User, 
  LogIn,
  LogOut,
  Menu,
  X,
  Bell,
  Bot,
  Info,
  Search,
  Filter,
  MapPin
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import UserPopup from '../ui/UserPopup';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

const CollegesHeader: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserPopupOpen, setIsUserPopupOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { user, signInWithGoogle, signOutUser } = useAuth();
  const pathname = usePathname();

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Close mobile menu and user popup on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false);
        setIsUserPopupOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Use body scroll lock for mobile menu
  useBodyScrollLock(isMobileMenuOpen);

  const navigationItems = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'Colleges', path: '/colleges', icon: GraduationCap },
    { name: 'Courses', path: '/courses', icon: BookOpen },
    { name: 'Cutoffs', path: '/cutoffs', icon: TrendingUp },
    { name: 'Dashboard', path: '/dashboard', icon: User },
    { name: 'About Us', path: '/about', icon: Info },
  ];

  const collegeActions = [
    { name: 'Search', icon: Search, action: 'search' },
    { name: 'Filters', icon: Filter, action: 'filters' },
    { name: 'Location', icon: MapPin, action: 'location' },
  ];

  return (
    <>
      <motion.header
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-white/95 backdrop-blur-md border-b border-gray-200"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center space-x-3 group">
              <motion.div
                className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <GraduationCap className="w-6 h-6 text-white" />
              </motion.div>
              <span className="text-2xl font-bold text-white">
                NeetLogIQ
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-8">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.path;
                return (
                  <Link
                    key={item.name}
                    href={item.path}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 ${
                      isActive
                          ? 'bg-blue-600 text-white'
                          : 'bg-blue-100 text-blue-700'
                        ? 'text-gray-300 hover:text-white hover:bg-gray-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <Icon size={18} />
                    <span className="font-medium">{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center space-x-4">
              {/* Theme Toggle */}

              {/* Notifications */}
              <motion.button
                className="p-2 rounded-lg transition-all duration-200 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Bell size={20} />
              </motion.button>

              {/* AI Assistant */}
              <motion.button
                className="p-2 rounded-lg transition-all duration-200 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Bot size={20} />
              </motion.button>

              {/* User Profile */}
              {user ? (
                <div className="relative">
                  <motion.button
                    onClick={() => setIsUserPopupOpen(!isUserPopupOpen)}
                    className="flex items-center space-x-2 p-2 rounded-lg transition-all duration-200 bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <User size={18} />
                    <span className="hidden lg:block font-medium">
                      {user.name || user.email?.split('@')[0] || 'User'}
                    </span>
                  </motion.button>
                  <UserPopup
                    isOpen={isUserPopupOpen}
                    onClose={() => setIsUserPopupOpen(false)}
                    user={user}
                    onLogout={signOutUser}
                  />
                </div>
              ) : (
                <button
                  onClick={signInWithGoogle}
                  className="flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600 text-sm"
                >
                  <LogIn size={16} />
                  <span className="font-medium">Sign In</span>
                </button>
              )}
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center space-x-2">
              {/* Theme Toggle for Mobile */}
              <div className="scale-75">
              </div>

              {/* Hamburger Menu Button */}
              <motion.button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-lg transition-all duration-200 bg-gray-100 text-gray-600 hover:bg-gray-200"
                whileTap={{ scale: 0.95 }}
                aria-label="Toggle mobile menu"
              >
                <AnimatePresence mode="wait">
                  {isMobileMenuOpen ? (
                    <motion.div
                      key="close"
                      initial={{ rotate: -90, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      exit={{ rotate: 90, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <X size={20} />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="menu"
                      initial={{ rotate: 90, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      exit={{ rotate: -90, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Menu size={20} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            </div>
          </div>
        </div>

        {/* Colleges Page Actions Bar */}
        {pathname === '/colleges' && (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between py-3">
                <h2 className="text-2xl font-bold text-white">
                  Medical Colleges
                </h2>
                <div className="flex items-center space-x-2">
                  {collegeActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <motion.button
                        key={action.name}
                        className="flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Icon size={16} />
                        <span className="text-sm font-medium">{action.name}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </div>
        )}

        {/* Mobile Menu Overlay */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm md:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobileMenuOpen(false)}
              />

              {/* Mobile Menu */}
              <motion.div
                className="fixed top-16 left-0 right-0 bottom-0 md:hidden bg-white/95 backdrop-blur-md border-t border-gray-200"
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="px-4 py-6 space-y-4 h-full">
                  {/* Navigation Links */}
                  {navigationItems.map((item, index) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.path;
                    return (
                      <motion.div
                        key={item.name}
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <Link
                          href={item.path}
                          className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                            isActive
                                ? 'bg-blue-600 text-white'
                                : 'bg-blue-100 text-blue-700'
                              ? 'text-gray-300 hover:text-white hover:bg-gray-700'
                              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                          }`}
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          <Icon size={20} />
                          <span className="font-medium">{item.name}</span>
                        </Link>
                      </motion.div>
                    );
                  })}

                  {/* User Section */}
                  <motion.div
                    className="pt-4 border-t border-gray-200 dark:border-gray-700"
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                  >
                    {user ? (
                      <div className="space-y-3">
                        <div className="flex items-center space-x-3 px-4 py-3 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 text-white">
                          <User size={20} />
                          <div>
                            <p className="font-medium">
                              {user.givenName || user.displayName || 'User'}
                            </p>
                            <p className="text-sm opacity-80">{user.email}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            signOutUser();
                            setIsMobileMenuOpen(false);
                          }}
                          className="flex items-center space-x-3 w-full px-4 py-3 rounded-lg transition-all duration-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <LogOut size={20} />
                          <span className="font-medium">Sign Out</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          signInWithGoogle();
                          setIsMobileMenuOpen(false);
                        }}
                        className="flex items-center space-x-3 w-full px-3 py-2 rounded-lg transition-all duration-200 bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600 text-sm"
                      >
                        <LogIn size={18} />
                        <span className="font-medium">Sign In</span>
                      </button>
                    )}
                  </motion.div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </motion.header>

      {/* Spacer to prevent content from being hidden behind fixed header */}
      <div className={`h-16 ${pathname === '/colleges' ? 'h-24' : ''}`} />
    </>
  );
};

export default CollegesHeader;
