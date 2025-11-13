'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Command, Search, X } from 'lucide-react';

interface ShortcutAction {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
}

const KeyboardShortcuts: React.FC = () => {
  const router = useRouter();
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const shortcuts: ShortcutAction[] = [
      {
        key: '/',
        description: 'Focus search',
        action: () => {
          const searchInput = document.querySelector('input[type="search"], input[placeholder*="search" i]') as HTMLInputElement;
          searchInput?.focus();
        },
      },
      {
        key: 'k',
        ctrl: true,
        description: 'Quick search (Cmd+K / Ctrl+K)',
        action: () => {
          const searchInput = document.querySelector('input[type="search"], input[placeholder*="search" i]') as HTMLInputElement;
          searchInput?.focus();
        },
      },
      {
        key: 'h',
        ctrl: true,
        description: 'Go to home',
        action: () => router.push('/'),
      },
      {
        key: 'd',
        ctrl: true,
        description: 'Go to dashboard',
        action: () => router.push('/dashboard'),
      },
      {
        key: 's',
        ctrl: true,
        description: 'Go to smart predictor',
        action: () => router.push('/smart'),
      },
      {
        key: 'a',
        ctrl: true,
        description: 'Go to analytics',
        action: () => router.push('/analytics'),
      },
      {
        key: '?',
        shift: true,
        description: 'Show keyboard shortcuts',
        action: () => setShowHelp(prev => !prev),
      },
      {
        key: 'Escape',
        description: 'Close modals/dialogs',
        action: () => {
          setShowHelp(false);
          // Close other modals if any
        },
      },
    ];

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        // Except for Escape
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur();
        }
        return;
      }

      shortcuts.forEach(shortcut => {
        const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : !e.ctrlKey && !e.metaKey;
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
        const altMatch = shortcut.alt ? e.altKey : !e.altKey;

        if (e.key === shortcut.key && ctrlMatch && shiftMatch && altMatch) {
          e.preventDefault();
          shortcut.action();
        }
      });
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [router]);

  return (
    <>
      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl">
                  <Command className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Keyboard Shortcuts
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Navigate faster with keyboard shortcuts
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowHelp(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Shortcuts List */}
            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Search
                </h3>
                <div className="space-y-2">
                  <ShortcutRow shortcut="/" description="Focus search bar" />
                  <ShortcutRow shortcut="Ctrl + K" description="Quick search" mac="⌘ K" />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Navigation
                </h3>
                <div className="space-y-2">
                  <ShortcutRow shortcut="Ctrl + H" description="Go to home" mac="⌘ H" />
                  <ShortcutRow shortcut="Ctrl + D" description="Go to dashboard" mac="⌘ D" />
                  <ShortcutRow shortcut="Ctrl + S" description="Go to smart predictor" mac="⌘ S" />
                  <ShortcutRow shortcut="Ctrl + A" description="Go to analytics" mac="⌘ A" />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  General
                </h3>
                <div className="space-y-2">
                  <ShortcutRow shortcut="Shift + ?" description="Show this help" />
                  <ShortcutRow shortcut="Esc" description="Close modals/dialogs" />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">Pro tip:</span> Press <kbd className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-xs font-mono">?</kbd> anytime to see this help
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Floating hint (optional) */}
      <button
        onClick={() => setShowHelp(true)}
        className="fixed bottom-8 left-8 z-40 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 group"
        aria-label="Show keyboard shortcuts"
        title="Keyboard shortcuts (Shift + ?)"
      >
        <Command className="h-5 w-5 text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
      </button>
    </>
  );
};

const ShortcutRow: React.FC<{ shortcut: string; description: string; mac?: string }> = ({
  shortcut,
  description,
  mac,
}) => {
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const displayShortcut = isMac && mac ? mac : shortcut;

  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
      <span className="text-sm text-gray-700 dark:text-gray-300">{description}</span>
      <kbd className="px-3 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-xs font-mono text-gray-700 dark:text-gray-300 shadow-sm">
        {displayShortcut}
      </kbd>
    </div>
  );
};

export default KeyboardShortcuts;
