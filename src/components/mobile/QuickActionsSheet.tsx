/**
 * QuickActionsSheet Component
 *
 * Mobile bottom sheet for quick actions with:
 * - Slide up from bottom animation
 * - Drag to dismiss
 * - Backdrop with blur
 * - Customizable action items
 * - Snap points for half/full sheet
 * - iOS-style design
 */

'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, PanInfo, useMotionValue, useTransform } from 'framer-motion';
import {
  X,
  ChevronDown,
  Share2,
  Download,
  Bookmark,
  Bell,
  Filter,
  SortAsc,
  Calculator,
  TrendingUp,
  MessageCircle,
  ExternalLink,
  Copy,
  Heart,
  Star
} from 'lucide-react';

export interface ActionItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: string;
  badge?: number | string;
  onClick: () => void;
  disabled?: boolean;
}

interface QuickActionsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  actions?: ActionItem[];
  snapPoints?: ('half' | 'full')[];
  defaultSnap?: 'half' | 'full';
  showHandle?: boolean;
  allowBackdropClose?: boolean;
}

const defaultActions: ActionItem[] = [
  {
    id: 'save',
    label: 'Save to Favorites',
    icon: Heart,
    color: 'red',
    onClick: () => console.log('Save')
  },
  {
    id: 'compare',
    label: 'Compare Colleges',
    icon: TrendingUp,
    color: 'blue',
    onClick: () => console.log('Compare')
  },
  {
    id: 'calculator',
    label: 'Chance Calculator',
    icon: Calculator,
    color: 'green',
    onClick: () => console.log('Calculator')
  },
  {
    id: 'share',
    label: 'Share',
    icon: Share2,
    color: 'purple',
    onClick: () => console.log('Share')
  },
  {
    id: 'download',
    label: 'Download Report',
    icon: Download,
    color: 'blue',
    onClick: () => console.log('Download')
  },
  {
    id: 'alert',
    label: 'Set Alert',
    icon: Bell,
    color: 'orange',
    onClick: () => console.log('Alert')
  }
];

export default function QuickActionsSheet({
  isOpen,
  onClose,
  title = 'Quick Actions',
  description,
  actions = defaultActions,
  snapPoints = ['half', 'full'],
  defaultSnap = 'half',
  showHandle = true,
  allowBackdropClose = true
}: QuickActionsSheetProps) {
  const [snapPoint, setSnapPoint] = useState<'half' | 'full'>(defaultSnap);
  const y = useMotionValue(0);
  const opacity = useTransform(y, [0, 300], [1, 0]);

  useEffect(() => {
    if (isOpen) {
      setSnapPoint(defaultSnap);
    }
  }, [isOpen, defaultSnap]);

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const velocity = info.velocity.y;
    const offset = info.offset.y;

    // Close if dragged down significantly
    if (offset > 200 || velocity > 500) {
      onClose();
      return;
    }

    // Toggle snap point if dragged up
    if (snapPoints.includes('full') && offset < -100) {
      setSnapPoint('full');
    } else if (snapPoints.includes('half') && offset > 50 && snapPoint === 'full') {
      setSnapPoint('half');
    }
  };

  const getColorClasses = (color: string = 'blue') => {
    const colorMap: Record<string, { bg: string; text: string }> = {
      blue: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400' },
      red: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400' },
      green: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400' },
      purple: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400' },
      orange: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400' },
      yellow: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-600 dark:text-yellow-400' }
    };
    return colorMap[color] || colorMap.blue;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={allowBackdropClose ? onClose : undefined}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
          />

          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{
              y: snapPoint === 'full' ? '5%' : '50%',
              transition: { type: 'spring', damping: 30, stiffness: 300 }
            }}
            exit={{ y: '100%' }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.2 }}
            onDragEnd={handleDragEnd}
            style={{ y, opacity }}
            className="fixed inset-x-0 bottom-0 z-[70] md:left-1/2 md:-translate-x-1/2 md:max-w-md"
          >
            <div className="bg-white dark:bg-gray-800 rounded-t-3xl shadow-2xl overflow-hidden">
              {/* Handle */}
              {showHandle && (
                <div className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing">
                  <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full" />
                </div>
              )}

              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      {title}
                    </h3>
                    {description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {description}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Actions Grid */}
              <div className="p-6 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-3 gap-4">
                  {actions.map((action) => {
                    const Icon = action.icon;
                    const colors = getColorClasses(action.color);

                    return (
                      <motion.button
                        key={action.id}
                        onClick={() => {
                          action.onClick();
                          onClose();
                        }}
                        disabled={action.disabled}
                        whileTap={{ scale: 0.95 }}
                        className="relative flex flex-col items-center p-4 rounded-2xl bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {/* Icon Container */}
                        <div className={`w-14 h-14 ${colors.bg} rounded-2xl flex items-center justify-center mb-3`}>
                          <Icon className={`w-7 h-7 ${colors.text}`} />
                        </div>

                        {/* Label */}
                        <span className="text-xs font-medium text-gray-900 dark:text-white text-center">
                          {action.label}
                        </span>

                        {/* Badge */}
                        {action.badge && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute top-2 right-2 min-w-5 h-5 px-1 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center"
                          >
                            {action.badge}
                          </motion.div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Snap Point Toggle (if both half and full are available) */}
              {snapPoints.length > 1 && (
                <div className="px-6 pb-6">
                  <button
                    onClick={() => setSnapPoint(snapPoint === 'half' ? 'full' : 'half')}
                    className="w-full py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl font-medium text-gray-900 dark:text-white transition-colors flex items-center justify-center space-x-2"
                  >
                    <ChevronDown className={`w-5 h-5 transition-transform ${snapPoint === 'full' ? 'rotate-180' : ''}`} />
                    <span>{snapPoint === 'half' ? 'Show More' : 'Show Less'}</span>
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/**
 * Share Sheet Component
 * Specialized sheet for sharing options
 */
export function ShareSheet({
  isOpen,
  onClose,
  shareUrl,
  shareTitle,
  shareText
}: {
  isOpen: boolean;
  onClose: () => void;
  shareUrl?: string;
  shareTitle?: string;
  shareText?: string;
}) {
  const handleShare = async (platform: string) => {
    const url = shareUrl || window.location.href;
    const text = shareText || shareTitle || document.title;

    // Native share if available
    if (navigator.share && platform === 'native') {
      try {
        await navigator.share({ title: shareTitle, text, url });
      } catch (error) {
        console.error('Share failed:', error);
      }
      return;
    }

    // Platform-specific sharing
    const shareUrls: Record<string, string> = {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`
    };

    if (shareUrls[platform]) {
      window.open(shareUrls[platform], '_blank', 'width=600,height=400');
    }
  };

  const handleCopyLink = () => {
    const url = shareUrl || window.location.href;
    navigator.clipboard.writeText(url);
    alert('Link copied to clipboard!');
  };

  const shareActions: ActionItem[] = [
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      icon: Share2,
      color: 'green',
      onClick: () => handleShare('whatsapp')
    },
    {
      id: 'telegram',
      label: 'Telegram',
      icon: Share2,
      color: 'blue',
      onClick: () => handleShare('telegram')
    },
    {
      id: 'twitter',
      label: 'Twitter',
      icon: Share2,
      color: 'blue',
      onClick: () => handleShare('twitter')
    },
    {
      id: 'facebook',
      label: 'Facebook',
      icon: Share2,
      color: 'blue',
      onClick: () => handleShare('facebook')
    },
    {
      id: 'linkedin',
      label: 'LinkedIn',
      icon: Share2,
      color: 'blue',
      onClick: () => handleShare('linkedin')
    },
    {
      id: 'copy',
      label: 'Copy Link',
      icon: Copy,
      color: 'gray',
      onClick: handleCopyLink
    }
  ];

  return (
    <QuickActionsSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Share"
      description="Share this college with others"
      actions={shareActions}
      snapPoints={['half']}
    />
  );
}

/**
 * Filter Sheet Component
 * Specialized sheet for filtering options
 */
export function FilterSheet({
  isOpen,
  onClose,
  onApplyFilters
}: {
  isOpen: boolean;
  onClose: () => void;
  onApplyFilters?: (filters: any) => void;
}) {
  const [selectedFilters, setSelectedFilters] = useState({
    managementType: [] as string[],
    state: [] as string[],
    budget: [0, 1000000] as [number, number]
  });

  const handleApply = () => {
    onApplyFilters?.(selectedFilters);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
          />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-[70] md:left-1/2 md:-translate-x-1/2 md:max-w-md"
          >
            <div className="bg-white dark:bg-gray-800 rounded-t-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full" />
              </div>

              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    Filters
                  </h3>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Filter Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Management Type */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                    Management Type
                  </h4>
                  <div className="space-y-2">
                    {['Government', 'Private', 'Trust', 'Deemed'].map((type) => (
                      <label key={type} className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedFilters.managementType.includes(type)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedFilters({
                                ...selectedFilters,
                                managementType: [...selectedFilters.managementType, type]
                              });
                            } else {
                              setSelectedFilters({
                                ...selectedFilters,
                                managementType: selectedFilters.managementType.filter(t => t !== type)
                              });
                            }
                          }}
                          className="w-5 h-5 text-blue-600 rounded"
                        />
                        <span className="text-gray-900 dark:text-white">{type}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Budget Range */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                    Annual Budget
                  </h4>
                  <div className="space-y-2">
                    <input
                      type="range"
                      min={0}
                      max={1000000}
                      step={10000}
                      value={selectedFilters.budget[1]}
                      onChange={(e) => setSelectedFilters({
                        ...selectedFilters,
                        budget: [0, parseInt(e.target.value)]
                      })}
                      className="w-full"
                    />
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Up to ₹{(selectedFilters.budget[1] / 1000).toFixed(0)}K per year
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex space-x-3">
                  <button
                    onClick={() => setSelectedFilters({
                      managementType: [],
                      state: [],
                      budget: [0, 1000000]
                    })}
                    className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl font-medium text-gray-900 dark:text-white transition-colors"
                  >
                    Reset
                  </button>
                  <button
                    onClick={handleApply}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-medium text-white transition-colors"
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
