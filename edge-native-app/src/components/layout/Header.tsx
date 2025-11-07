'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Menu, 
  X, 
  Search, 
  User, 
  LogOut, 
  LogIn, 
  MessageCircle, 
  Bell,
  LayoutDashboard,
  Building2,
  GraduationCap,
  TrendingUp,
  Bot,
  Briefcase,
  BarChart3,
  GitCompare,
  Info,
  ChevronDown,
  Settings,
  Sun,
  Moon,
  Code,
  Zap
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import dynamic from 'next/dynamic';

const AIChatbot = dynamic(() => import('@/components/ai/AIChatbot'), {
  loading: () => <div className="animate-pulse bg-gray-200 h-8 w-8 rounded"></div>,
  ssr: false
});

const NotificationCenter = dynamic(() => import('@/components/NotificationCenter'), {
  loading: () => <div className="animate-pulse bg-gray-200 h-6 w-6 rounded"></div>,
  ssr: false
});

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isExploreOpen, setIsExploreOpen] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const { user, signInWithGoogle, signOut } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  // Navigation items
  const dashboardItem = {
    name: 'Dashboard',
    path: '/dashboard',
    icon: LayoutDashboard
  };

  const exploreItems = [
    { name: 'Colleges', path: '/colleges', icon: Building2 },
    { name: 'Courses', path: '/courses', icon: GraduationCap },
    { name: 'Cutoffs', path: '/cutoffs', icon: TrendingUp }
  ];

  const toolsItems = [
    { name: 'AI Assistant', path: '/ai-assistant', icon: Bot },
    { name: 'VibeSDK', path: '/vibe', icon: Code },
    { name: 'Career Guidance', path: '/career-guidance', icon: Briefcase },
    { name: 'Trends', path: '/trends', icon: BarChart3 },
    { name: 'Compare', path: '/compare', icon: GitCompare }
  ];

  const aboutItem = {
    name: 'About',
    path: '/about',
    icon: Info
  };

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  // Close dropdowns when route changes
  useEffect(() => {
    setIsExploreOpen(false);
    setIsToolsOpen(false);
    setIsUserMenuOpen(false);
  }, [pathname]);

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Sign in failed:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setIsUserMenuOpen(false);
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        isDarkMode ? 'bg-black/20 backdrop-blur-md' : 'bg-white/80 backdrop-blur-md'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              isDarkMode ? 'bg-blue-600' : 'bg-blue-500'
            }`}>
                <span className="text-white font-bold text-lg">N</span>
              </div>
            <span className={`font-bold text-xl ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
                NeetLogIQ
              </span>
            </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {/* Dashboard */}
            <Link
              href="/dashboard"
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 ${
                pathname === dashboardItem.path
                  ? isDarkMode
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-100 text-blue-700'
                  : isDarkMode
                  ? 'text-gray-300 hover:text-white hover:bg-gray-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <LayoutDashboard size={18} />
              <span className="font-medium">Dashboard</span>
            </Link>

            {/* Explore Dropdown */}
            <div 
              className="relative dropdown"
              onMouseEnter={() => setIsExploreOpen(true)}
              onMouseLeave={() => setIsExploreOpen(false)}
            >
              <button
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 ${
                  exploreItems.some(item => pathname === item.path)
                    ? isDarkMode
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-100 text-blue-700'
                    : isDarkMode
                    ? 'text-gray-300 hover:text-white hover:bg-gray-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <span className="font-medium">Explore</span>
                <ChevronDown size={16} className={`transition-transform duration-200 ${isExploreOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {isExploreOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className={`absolute top-full left-0 mt-1 w-48 rounded-lg shadow-lg border z-50 ${
                      isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                    }`}
                  >
                    {exploreItems.map((item) => (
              <Link
                key={item.name}
                        href={item.path}
                        className={`flex items-center space-x-3 px-4 py-2.5 transition-colors w-full text-left ${
                          isDarkMode
                            ? 'text-gray-300 hover:bg-gray-800 hover:text-white'
                            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                        }`}
                      >
                        <item.icon size={18} />
                        <span className="text-sm font-medium">{item.name}</span>
                      </Link>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Tools Dropdown */}
            <div 
              className="relative dropdown"
              onMouseEnter={() => setIsToolsOpen(true)}
              onMouseLeave={() => setIsToolsOpen(false)}
            >
              <button
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 ${
                  toolsItems.some(item => pathname === item.path)
                    ? isDarkMode
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-100 text-blue-700'
                    : isDarkMode
                    ? 'text-gray-300 hover:text-white hover:bg-gray-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <span className="font-medium">Tools</span>
                <ChevronDown size={16} className={`transition-transform duration-200 ${isToolsOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {isToolsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className={`absolute top-full left-0 mt-1 w-48 rounded-lg shadow-lg border z-50 ${
                      isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                    }`}
                  >
                    {toolsItems.map((item) => (
                      <Link
                        key={item.name}
                        href={item.path}
                        className={`flex items-center space-x-3 px-4 py-2.5 transition-colors w-full text-left ${
                          isDarkMode
                            ? 'text-gray-300 hover:bg-gray-800 hover:text-white'
                            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                        }`}
                      >
                        <item.icon size={18} />
                        <span className="text-sm font-medium">{item.name}</span>
              </Link>
            ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* About */}
            <Link
              href="/about"
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 ${
                pathname === aboutItem.path
                  ? isDarkMode
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-100 text-blue-700'
                  : isDarkMode
                  ? 'text-gray-300 hover:text-white hover:bg-gray-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Info size={18} />
              <span className="font-medium">About</span>
            </Link>
          </nav>

          {/* Right side items */}
          <div className="flex items-center space-x-2">
            {/* Search */}
            <button
              onClick={() => router.push('/search')}
              className={`p-2 rounded-lg transition-colors ${
                isDarkMode 
                  ? 'text-gray-300 hover:text-white hover:bg-gray-700' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
              title="Search"
            >
              <Search className="h-5 w-5" />
            </button>
            
            {/* Notifications */}
            <NotificationCenter />

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg transition-colors ${
                isDarkMode 
                  ? 'text-gray-300 hover:text-white hover:bg-gray-700' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
              title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            {/* User Menu or Login */}
            {user ? (
              <div 
                className="relative dropdown"
                onMouseEnter={() => setIsUserMenuOpen(true)}
                onMouseLeave={() => setIsUserMenuOpen(false)}
              >
                <button
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 ${
                    isDarkMode
                      ? 'text-gray-300 hover:text-white hover:bg-gray-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'User'}
                      className="h-6 w-6 rounded-full"
                    />
                  ) : (
                    <User size={18} />
                  )}
                  <span className="font-medium">{user.displayName || 'User'}</span>
                  <ChevronDown size={16} className={`transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                {isUserMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className={`absolute top-full right-0 mt-1 w-48 rounded-lg shadow-lg border z-50 ${
                        isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                      }`}
                    >
                      <Link
                        href="/profile"
                        className={`flex items-center space-x-3 px-4 py-2.5 transition-colors w-full text-left ${
                          isDarkMode
                            ? 'text-gray-300 hover:bg-gray-800 hover:text-white'
                            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                        }`}
                      >
                        <User size={18} />
                        <span className="text-sm font-medium font-geist">Profile</span>
                      </Link>
                      <Link
                        href="/dashboard"
                        className={`flex items-center space-x-3 px-4 py-2.5 transition-colors w-full text-left ${
                          isDarkMode
                            ? 'text-gray-300 hover:bg-gray-800 hover:text-white'
                            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                        }`}
                      >
                        <LayoutDashboard size={18} />
                        <span className="text-sm font-medium font-geist">Dashboard</span>
                      </Link>
                      <Link
                        href="/settings"
                        className={`flex items-center space-x-3 px-4 py-2.5 transition-colors w-full text-left ${
                          isDarkMode
                            ? 'text-gray-300 hover:bg-gray-800 hover:text-white'
                            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                        }`}
                      >
                        <Settings size={18} />
                        <span className="text-sm font-medium font-geist">Settings</span>
                      </Link>
                      <div className={`border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}></div>
                      <button
                        onClick={handleSignOut}
                        className={`flex items-center space-x-3 px-4 py-2.5 transition-colors w-full text-left ${
                          isDarkMode
                            ? 'text-gray-300 hover:bg-gray-800 hover:text-white'
                            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                        }`}
                      >
                        <LogOut size={18} />
                        <span className="text-sm font-medium font-geist">Sign Out</span>
                    </button>
                    </motion.div>
                )}
                </AnimatePresence>
              </div>
            ) : (
              <button
                onClick={handleSignIn}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <LogIn className="h-4 w-4" />
                <span>Sign In</span>
              </button>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={`p-2 rounded-lg transition-colors ${
                isDarkMode 
                  ? 'text-gray-300 hover:text-white hover:bg-gray-700' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <AnimatePresence>
        {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden overflow-hidden"
            >
              <div className={`px-4 py-4 space-y-2 ${
                isDarkMode ? 'bg-gray-800' : 'bg-white'
              }`}>
                {/* Dashboard */}
                <Link
                  href="/dashboard"
                  className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                    pathname === '/dashboard'
                      ? isDarkMode
                        ? 'bg-blue-600 text-white'
                        : 'bg-blue-100 text-blue-700'
                      : isDarkMode
                      ? 'text-gray-300 hover:bg-gray-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  <LayoutDashboard size={18} />
                  <span className="font-medium">Dashboard</span>
                </Link>

                {/* Explore Section */}
                <div className="space-y-1">
                  <div className={`px-3 py-2 text-sm font-semibold ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Explore
                  </div>
                  {exploreItems.map((item) => (
                    <Link
                      key={item.name}
                      href={item.path}
                      className={`flex items-center space-x-3 px-6 py-2 rounded-lg transition-colors ${
                        pathname === item.path
                          ? isDarkMode
                            ? 'bg-blue-600 text-white'
                            : 'bg-blue-100 text-blue-700'
                          : isDarkMode
                          ? 'text-gray-300 hover:bg-gray-700'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <item.icon size={18} />
                      <span className="font-medium">{item.name}</span>
                    </Link>
                  ))}
                </div>

                {/* Tools Section */}
                <div className="space-y-1">
                  <div className={`px-3 py-2 text-sm font-semibold ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Tools
                  </div>
                  {toolsItems.map((item) => (
                <Link
                  key={item.name}
                      href={item.path}
                      className={`flex items-center space-x-3 px-6 py-2 rounded-lg transition-colors ${
                        pathname === item.path
                          ? isDarkMode
                            ? 'bg-blue-600 text-white'
                            : 'bg-blue-100 text-blue-700'
                          : isDarkMode
                          ? 'text-gray-300 hover:bg-gray-700'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <item.icon size={18} />
                      <span className="font-medium">{item.name}</span>
                    </Link>
                  ))}
                </div>

                {/* About */}
                <Link
                  href="/about"
                  className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                    pathname === '/about'
                      ? isDarkMode
                        ? 'bg-blue-600 text-white'
                        : 'bg-blue-100 text-blue-700'
                      : isDarkMode
                      ? 'text-gray-300 hover:bg-gray-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Info size={18} />
                  <span className="font-medium">About</span>
                </Link>

                {/* Divider */}
                <div className={`border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}></div>

                {/* Search */}
              <button
                onClick={() => {
                  router.push('/search');
                  setIsMenuOpen(false);
                }}
                  className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors w-full text-left ${
                    isDarkMode
                      ? 'text-gray-300 hover:bg-gray-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Search className="h-5 w-5" />
                  <span className="font-medium">Search</span>
              </button>

                {/* Theme Toggle */}
              <button
                onClick={() => {
                  toggleTheme();
                  setIsMenuOpen(false);
                }}
                  className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors w-full text-left ${
                    isDarkMode
                      ? 'text-gray-300 hover:bg-gray-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                  <span className="font-medium">{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
              </button>

                {/* User Actions */}
              {user ? (
                  <>
                    <div className={`border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}></div>
                    <Link
                      href="/profile"
                      className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                        isDarkMode
                          ? 'text-gray-300 hover:bg-gray-700'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <User size={18} />
                      <span className="font-medium">Profile</span>
                    </Link>
                <button
                  onClick={() => {
                    handleSignOut();
                    setIsMenuOpen(false);
                  }}
                      className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors w-full text-left ${
                        isDarkMode
                          ? 'text-gray-300 hover:bg-gray-700'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <LogOut size={18} />
                      <span className="font-medium">Sign Out</span>
                </button>
                  </>
              ) : (
                <button
                  onClick={() => {
                    handleSignIn();
                    setIsMenuOpen(false);
                  }}
                    className="flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors w-full text-left bg-blue-600 hover:bg-blue-700 text-white"
                >
                    <LogIn size={18} />
                    <span className="font-medium">Sign In</span>
                </button>
              )}
            </div>
            </motion.div>
        )}
        </AnimatePresence>

        {/* AI Chatbot */}
        <AIChatbot
          isOpen={isChatbotOpen}
          onClose={() => setIsChatbotOpen(false)}
        />
      </div>
    </motion.header>
  );
};

export default Header;
