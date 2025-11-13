/**
 * MobileBottomNavigation Component
 *
 * iOS-style bottom navigation for mobile devices with:
 * - Fixed bottom navigation bar
 * - Smooth animations and transitions
 * - Active state indicators
 * - Badge notifications
 * - Haptic-like feedback animations
 * - Auto-hide on scroll down
 */

'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  Search,
  Heart,
  TrendingUp,
  User,
  Bell,
  Sparkles
} from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badge?: number;
  color?: string;
}

interface MobileBottomNavigationProps {
  items?: NavItem[];
  onItemClick?: (item: NavItem) => void;
  autoHide?: boolean;
  className?: string;
}

const defaultItems: NavItem[] = [
  {
    id: 'home',
    label: 'Home',
    icon: Home,
    href: '/dashboard',
    color: 'blue'
  },
  {
    id: 'explore',
    label: 'Explore',
    icon: Search,
    href: '/explore',
    color: 'purple'
  },
  {
    id: 'cutoffs',
    label: 'Cutoffs',
    icon: TrendingUp,
    href: '/cutoffs',
    color: 'green'
  },
  {
    id: 'saved',
    label: 'Saved',
    icon: Heart,
    href: '/favorites',
    badge: 5,
    color: 'red'
  },
  {
    id: 'profile',
    label: 'Profile',
    icon: User,
    href: '/profile',
    color: 'gray'
  }
];

export default function MobileBottomNavigation({
  items = defaultItems,
  onItemClick,
  autoHide = true,
  className = ''
}: MobileBottomNavigationProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [activeItem, setActiveItem] = useState<string>('home');
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Detect active item based on current path
  useEffect(() => {
    const currentItem = items.find(item => pathname?.startsWith(item.href));
    if (currentItem) {
      setActiveItem(currentItem.id);
    }
  }, [pathname, items]);

  // Auto-hide on scroll down
  useEffect(() => {
    if (!autoHide) return;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        // Scrolling down
        setIsVisible(false);
      } else {
        // Scrolling up
        setIsVisible(true);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY, autoHide]);

  const handleItemClick = (item: NavItem) => {
    setActiveItem(item.id);
    router.push(item.href);
    onItemClick?.(item);

    // Simulate haptic feedback with a quick scale animation
    // The animation is handled by Framer Motion in the component
  };

  const getColorClasses = (color: string = 'blue') => {
    const colorMap: Record<string, { bg: string; text: string; ring: string }> = {
      blue: {
        bg: 'bg-blue-500',
        text: 'text-blue-600 dark:text-blue-400',
        ring: 'ring-blue-500/20'
      },
      purple: {
        bg: 'bg-purple-500',
        text: 'text-purple-600 dark:text-purple-400',
        ring: 'ring-purple-500/20'
      },
      green: {
        bg: 'bg-green-500',
        text: 'text-green-600 dark:text-green-400',
        ring: 'ring-green-500/20'
      },
      red: {
        bg: 'bg-red-500',
        text: 'text-red-600 dark:text-red-400',
        ring: 'ring-red-500/20'
      },
      gray: {
        bg: 'bg-gray-500',
        text: 'text-gray-600 dark:text-gray-400',
        ring: 'ring-gray-500/20'
      }
    };

    return colorMap[color] || colorMap.blue;
  };

  return (
    <>
      {/* Spacer to prevent content from being hidden behind fixed nav */}
      <div className="h-20 md:hidden" />

      {/* Bottom Navigation */}
      <AnimatePresence>
        {isVisible && (
          <motion.nav
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className={`fixed bottom-0 left-0 right-0 z-50 md:hidden ${className}`}
          >
            {/* Backdrop with blur */}
            <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-t border-gray-200 dark:border-gray-800" />

            {/* Navigation Items */}
            <div className="relative px-2 pt-2 pb-safe">
              <div className="grid grid-cols-5 gap-1">
                {items.map((item) => {
                  const isActive = activeItem === item.id;
                  const Icon = item.icon;
                  const colors = getColorClasses(item.color);

                  return (
                    <motion.button
                      key={item.id}
                      onClick={() => handleItemClick(item)}
                      className="relative flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-colors"
                      whileTap={{ scale: 0.9 }}
                      whileHover={{ scale: 1.05 }}
                    >
                      {/* Active background indicator */}
                      {isActive && (
                        <motion.div
                          layoutId="activeBackground"
                          className="absolute inset-0 bg-gray-100 dark:bg-gray-800 rounded-xl"
                          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        />
                      )}

                      {/* Icon container */}
                      <div className="relative">
                        {/* Icon */}
                        <div className="relative">
                          <Icon
                            className={`w-6 h-6 transition-colors ${
                              isActive
                                ? colors.text
                                : 'text-gray-500 dark:text-gray-400'
                            }`}
                          />

                          {/* Active indicator dot */}
                          {isActive && (
                            <motion.div
                              layoutId="activeDot"
                              className={`absolute -top-1 -right-1 w-2 h-2 ${colors.bg} rounded-full`}
                              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            />
                          )}
                        </div>

                        {/* Badge */}
                        {item.badge && item.badge > 0 && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute -top-2 -right-2 min-w-5 h-5 px-1 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center"
                          >
                            {item.badge > 99 ? '99+' : item.badge}
                          </motion.div>
                        )}
                      </div>

                      {/* Label */}
                      <span
                        className={`relative text-xs font-medium mt-1 transition-colors ${
                          isActive
                            ? colors.text
                            : 'text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {item.label}
                      </span>

                      {/* Ripple effect on tap */}
                      {isActive && (
                        <motion.div
                          initial={{ scale: 0, opacity: 0.5 }}
                          animate={{ scale: 2, opacity: 0 }}
                          transition={{ duration: 0.6 }}
                          className={`absolute inset-0 rounded-xl ring-4 ${colors.ring}`}
                        />
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* iOS-style home indicator */}
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-32 h-1 bg-gray-400 dark:bg-gray-600 rounded-full" />
          </motion.nav>
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * Floating Action Button (FAB) Component
 * Can be used alongside bottom navigation for primary actions
 */
export function MobileFAB({
  icon: Icon = Sparkles,
  label,
  onClick,
  color = 'blue',
  badge,
  className = ''
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label?: string;
  onClick?: () => void;
  color?: string;
  badge?: number;
  className?: string;
}) {
  const [isPressed, setIsPressed] = useState(false);

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-600 hover:bg-blue-700',
    purple: 'bg-purple-600 hover:bg-purple-700',
    green: 'bg-green-600 hover:bg-green-700',
    red: 'bg-red-600 hover:bg-red-700',
    orange: 'bg-orange-600 hover:bg-orange-700'
  };

  return (
    <motion.button
      onClick={onClick}
      onTapStart={() => setIsPressed(true)}
      onTap={() => setIsPressed(false)}
      onTapCancel={() => setIsPressed(false)}
      whileTap={{ scale: 0.9 }}
      whileHover={{ scale: 1.1 }}
      className={`fixed bottom-24 right-6 z-40 md:hidden ${className}`}
    >
      <div className="relative">
        {/* Shadow */}
        <div className="absolute inset-0 bg-black/20 rounded-2xl blur-xl" />

        {/* Button */}
        <div
          className={`relative w-14 h-14 ${
            colorMap[color] || colorMap.blue
          } rounded-2xl shadow-lg flex items-center justify-center text-white transition-colors`}
        >
          <Icon className="w-6 h-6" />

          {/* Badge */}
          {badge && badge > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-white"
            >
              {badge > 99 ? '99+' : badge}
            </motion.div>
          )}
        </div>

        {/* Ripple effect */}
        <AnimatePresence>
          {isPressed && (
            <motion.div
              initial={{ scale: 1, opacity: 0.5 }}
              animate={{ scale: 2, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="absolute inset-0 bg-white rounded-2xl"
            />
          )}
        </AnimatePresence>
      </div>

      {/* Label tooltip */}
      {label && (
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          whileHover={{ opacity: 1, x: 0 }}
          className="absolute right-16 top-1/2 -translate-y-1/2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-sm font-medium rounded-lg whitespace-nowrap shadow-lg pointer-events-none"
        >
          {label}
          {/* Arrow */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 rotate-45 w-2 h-2 bg-gray-900 dark:bg-gray-700" />
        </motion.div>
      )}
    </motion.button>
  );
}

/**
 * Mobile Tab Bar Item Component
 * Can be used for custom tab implementations
 */
export function MobileTabBarItem({
  icon: Icon,
  label,
  isActive,
  onClick,
  badge,
  color = 'blue'
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  isActive?: boolean;
  onClick?: () => void;
  badge?: number;
  color?: string;
}) {
  const colors = {
    blue: 'text-blue-600 dark:text-blue-400',
    purple: 'text-purple-600 dark:text-purple-400',
    green: 'text-green-600 dark:text-green-400',
    red: 'text-red-600 dark:text-red-400'
  };

  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.9 }}
      className="relative flex flex-col items-center justify-center py-2 px-3 rounded-xl"
    >
      {isActive && (
        <motion.div
          layoutId="tabBackground"
          className="absolute inset-0 bg-gray-100 dark:bg-gray-800 rounded-xl"
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
      )}

      <div className="relative">
        <Icon
          className={`w-6 h-6 transition-colors ${
            isActive
              ? colors[color as keyof typeof colors] || colors.blue
              : 'text-gray-500 dark:text-gray-400'
          }`}
        />

        {badge && badge > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-2 -right-2 min-w-5 h-5 px-1 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center"
          >
            {badge > 99 ? '99+' : badge}
          </motion.div>
        )}
      </div>

      <span
        className={`relative text-xs font-medium mt-1 transition-colors ${
          isActive
            ? colors[color as keyof typeof colors] || colors.blue
            : 'text-gray-500 dark:text-gray-400'
        }`}
      >
        {label}
      </span>
    </motion.button>
  );
}
