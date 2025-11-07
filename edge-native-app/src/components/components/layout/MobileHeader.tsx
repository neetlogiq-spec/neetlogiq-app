'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu, X, Search, User, LogOut, LogIn, MessageCircle, Bell, Home, BarChart, GitCompare, Heart, Brain, BookOpen, TrendingUp, GraduationCap } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

const MobileHeader: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const { user, signInWithGoogle, signOut } = useAuth();
  const router = useRouter();

  const navigation = [
    { name: 'Home', href: '/', icon: Home },
    { name: 'Colleges', href: '/colleges', icon: GraduationCap },
    { name: 'Courses', href: '/courses', icon: BookOpen },
    { name: 'Cutoffs', href: '/cutoffs', icon: TrendingUp },
    { name: 'Dashboard', href: '/dashboard', icon: BarChart },
    { name: 'About Us', href: '/about', icon: User },
  ];

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
      setIsMenuOpen(false);
    } catch (error) {
      console.error('Sign in failed:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setIsUserMenuOpen(false);
      setIsMenuOpen(false);
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  const handleNavigation = (href: string) => {
    router.push(href);
    setIsMenuOpen(false);
  };

  return (
    <>
      {/* Mobile Header */}
      <header className="md:hidden bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center">
              <div className="h-8 w-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">N</span>
              </div>
              <span className="ml-2 text-lg font-bold text-gray-900 dark:text-white">
                NeetLogIQ
              </span>
            </Link>

            {/* Right side buttons */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleNavigation('/search')}
                className="p-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                title="Search"
              >
                <Search className="h-5 w-5" />
              </button>
              
              <button
                onClick={() => handleNavigation('/favorites')}
                className="p-2 text-gray-700 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 transition-colors relative"
                title="Favorites"
              >
                <Heart className="h-5 w-5" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
              </button>

              <button
                onClick={toggleTheme}
                className="p-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                title="Toggle Theme"
              >
              </button>

              {/* User Menu */}
              {user ? (
                <div className="relative">
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center space-x-1 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName}
                        className="h-6 w-6 rounded-full"
                      />
                    ) : (
                      <User className="h-6 w-6" />
                    )}
                  </button>

                  {isUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-50">
                      <div className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                        {user.displayName}
                      </div>
                      <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
                        {user.email}
                      </div>
                      <button
                        onClick={handleSignOut}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={handleSignIn}
                  className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                >
                  <LogIn className="h-4 w-4" />
                  <span>Sign In</span>
                </button>
              )}

              {/* Menu Button */}
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMenuOpen && (
          <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
            <div className="px-4 py-2 space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.name}
                    onClick={() => handleNavigation(item.href)}
                    className="flex items-center w-full text-left px-3 py-3 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <Icon className="h-5 w-5 mr-3" />
                    <span className="font-medium">{item.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* Desktop Header - Hidden on mobile */}
      <header className="hidden md:block bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex-shrink-0">
              <Link href="/" className="flex items-center">
                <div className="h-8 w-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">N</span>
                </div>
                <span className="ml-2 text-xl font-bold text-gray-900 dark:text-white">
                  NeetLogIQ
                </span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex space-x-8">
              {navigation.slice(0, 6).map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  {item.name}
                </Link>
              ))}
            </nav>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center space-x-4">
              <button
                onClick={() => handleNavigation('/search')}
                className="p-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                title="Search"
              >
                <Search className="h-5 w-5" />
              </button>
              
              <button
                onClick={() => handleNavigation('/favorites')}
                className="p-2 text-gray-700 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 transition-colors relative"
                title="Favorites"
              >
                <Heart className="h-5 w-5" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
              </button>

              <button
                onClick={toggleTheme}
                className="p-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                title="Toggle Theme"
              >
              </button>

              {/* User Menu */}
              {user ? (
                <div className="relative">
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName}
                        className="h-8 w-8 rounded-full"
                      />
                    ) : (
                      <User className="h-8 w-8" />
                    )}
                    <span className="text-sm font-medium">{user.givenName || user.displayName}</span>
                  </button>

                  {isUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-50">
                      <div className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                        {user.displayName}
                      </div>
                      <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
                        {user.email}
                      </div>
                      <button
                        onClick={handleSignOut}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={handleSignIn}
                  className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  <LogIn className="h-4 w-4" />
                  <span>Sign In</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>
    </>
  );
};

export default MobileHeader;
