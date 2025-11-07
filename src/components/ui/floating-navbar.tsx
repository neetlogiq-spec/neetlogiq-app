"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { 
  Home, 
  GraduationCap, 
  BookOpen, 
  TrendingUp, 
  BarChart, 
  User, 
  Search, 
  Heart, 
  Bell, 
  MessageCircle,
  LogIn,
  LogOut
} from "lucide-react";

interface NavItem {
  name: string;
  link: string;
  icon: React.ReactNode;
}

interface FloatingNavProps {
  navItems: NavItem[];
}

export function FloatingNav({ navItems }: FloatingNavProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const pathname = usePathname();
  const { user, signInWithGoogle, signOut } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Show navbar when at the top
      if (currentScrollY < 10) {
        setIsVisible(true);
        setIsScrolling(false);
      } else {
        // Hide when scrolling down, show when scrolling up
        if (currentScrollY > lastScrollY && currentScrollY > 100) {
          setIsVisible(false);
          setIsScrolling(true);
        } else if (currentScrollY < lastScrollY) {
          setIsVisible(true);
          setIsScrolling(false);
        }
      }
      
      setLastScrollY(currentScrollY);
    };

    // Throttle scroll events for better performance
    let ticking = false;
    const throttledHandleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", throttledHandleScroll, { passive: true });
    return () => window.removeEventListener("scroll", throttledHandleScroll);
  }, [lastScrollY]);

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("Sign in failed:", error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  };

  return (
    <div
      className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ease-in-out ${
        isVisible 
          ? "translate-y-0 opacity-100" 
          : "translate-y-[-100px] opacity-0"
      }`}
    >
      <div className="flex items-center space-x-1 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border border-gray-200/50 dark:border-gray-700/50 rounded-full px-4 py-2 shadow-lg">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2 mr-2">
          <div className="h-8 w-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">N</span>
          </div>
          <span className="text-sm font-semibold text-gray-900 dark:text-white hidden sm:block">
            NeetLogIQ
          </span>
        </Link>

        {/* Navigation Items */}
        <div className="flex items-center space-x-1">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.link}
              className={`flex items-center space-x-1 px-3 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                pathname === item.link
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              <span className="h-4 w-4">{item.icon}</span>
              <span className="hidden md:block">{item.name}</span>
            </Link>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-1 ml-2">
          {/* Search */}
          <button
            onClick={() => window.location.href = '/search'}
            className="p-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            title="Search"
          >
            <Search className="h-4 w-4" />
          </button>

          {/* Favorites */}
          <button
            onClick={() => window.location.href = '/favorites'}
            className="p-2 text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors relative"
            title="Favorites"
          >
            <Heart className="h-4 w-4" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
          </button>

          {/* Notifications */}
          <button
            className="p-2 text-gray-600 dark:text-gray-300 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors relative"
            title="Notifications"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
          </button>

          {/* AI Assistant */}
          <button
            className="p-2 text-gray-600 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors relative"
            title="AI Assistant"
          >
            <MessageCircle className="h-4 w-4" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          </button>

          {/* Theme Toggle */}

          {/* User Menu */}
          {user ? (
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-medium">
                  {(user.givenName || user.displayName || 'U').charAt(0).toUpperCase()}
                </span>
              </div>
              <button
                onClick={handleSignOut}
                className="p-2 text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                title="Sign Out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleSignIn}
              className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
            >
              <LogIn className="h-4 w-4" />
              <span className="hidden sm:block">Sign In</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Default navigation items
export const defaultNavItems: NavItem[] = [
  {
    name: "Home",
    link: "/",
    icon: <Home className="h-4 w-4" />,
  },
  {
    name: "Colleges",
    link: "/colleges",
    icon: <GraduationCap className="h-4 w-4" />,
  },
  {
    name: "Courses",
    link: "/courses",
    icon: <BookOpen className="h-4 w-4" />,
  },
  {
    name: "Cutoffs",
    link: "/cutoffs",
    icon: <TrendingUp className="h-4 w-4" />,
  },
  {
    name: "Dashboard",
    link: "/dashboard",
    icon: <BarChart className="h-4 w-4" />,
  },
  {
    name: "About Us",
    link: "/about",
    icon: <User className="h-4 w-4" />,
  },
];
