import { useEffect, useCallback } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  description: string;
  action: () => void;
}

export interface KeyboardShortcutConfig {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
}

/**
 * Custom hook for managing keyboard shortcuts in the staging review interface
 * @param config Configuration object containing shortcuts and enabled state
 */
export function useKeyboardShortcuts(config: KeyboardShortcutConfig) {
  const { shortcuts, enabled = true } = config;

  const handleKeyPress = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger shortcuts when typing in input fields
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      for (const shortcut of shortcuts) {
        const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatches = shortcut.ctrlKey ? event.ctrlKey : !event.ctrlKey;
        const shiftMatches = shortcut.shiftKey ? event.shiftKey : !event.shiftKey;
        const altMatches = shortcut.altKey ? event.altKey : !event.altKey;
        const metaMatches = shortcut.metaKey ? event.metaKey : !event.metaKey;

        if (keyMatches && ctrlMatches && shiftMatches && altMatches && metaMatches) {
          event.preventDefault();
          shortcut.action();
          break;
        }
      }
    },
    [shortcuts, enabled]
  );

  useEffect(() => {
    if (enabled) {
      window.addEventListener('keydown', handleKeyPress);
      return () => window.removeEventListener('keydown', handleKeyPress);
    }
  }, [handleKeyPress, enabled]);

  return { shortcuts };
}

/**
 * Pre-defined keyboard shortcut configurations for staging review
 */
export const createStagingReviewShortcuts = (handlers: {
  onNextItem?: () => void;
  onPreviousItem?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  onSearch?: () => void;
  onExport?: () => void;
  onRefresh?: () => void;
  onHelp?: () => void;
  onTabColleges?: () => void;
  onTabCourses?: () => void;
  onTabCutoffs?: () => void;
  onTabStats?: () => void;
}): KeyboardShortcut[] => {
  const shortcuts: KeyboardShortcut[] = [];

  if (handlers.onNextItem) {
    shortcuts.push({
      key: 'ArrowDown',
      description: 'Navigate to next item',
      action: handlers.onNextItem
    });
  }

  if (handlers.onPreviousItem) {
    shortcuts.push({
      key: 'ArrowUp',
      description: 'Navigate to previous item',
      action: handlers.onPreviousItem
    });
  }

  if (handlers.onApprove) {
    shortcuts.push({
      key: 'a',
      description: 'Approve current match',
      action: handlers.onApprove
    });
  }

  if (handlers.onReject) {
    shortcuts.push({
      key: 'r',
      description: 'Reject current match',
      action: handlers.onReject
    });
  }

  if (handlers.onSearch) {
    shortcuts.push({
      key: 'f',
      ctrlKey: true,
      description: 'Focus search box',
      action: handlers.onSearch
    });
  }

  if (handlers.onExport) {
    shortcuts.push({
      key: 'e',
      ctrlKey: true,
      description: 'Export to markdown',
      action: handlers.onExport
    });
  }

  if (handlers.onRefresh) {
    shortcuts.push({
      key: 'r',
      ctrlKey: true,
      description: 'Refresh data',
      action: handlers.onRefresh
    });
  }

  if (handlers.onHelp) {
    shortcuts.push({
      key: '?',
      shiftKey: true,
      description: 'Show keyboard shortcuts help',
      action: handlers.onHelp
    });
  }

  if (handlers.onTabColleges) {
    shortcuts.push({
      key: '1',
      description: 'Switch to Colleges tab',
      action: handlers.onTabColleges
    });
  }

  if (handlers.onTabCourses) {
    shortcuts.push({
      key: '2',
      description: 'Switch to Courses tab',
      action: handlers.onTabCourses
    });
  }

  if (handlers.onTabCutoffs) {
    shortcuts.push({
      key: '3',
      description: 'Switch to Cutoffs tab',
      action: handlers.onTabCutoffs
    });
  }

  if (handlers.onTabStats) {
    shortcuts.push({
      key: '4',
      description: 'Switch to Statistics tab',
      action: handlers.onTabStats
    });
  }

  return shortcuts;
};

/**
 * Format keyboard shortcut for display
 */
export function formatShortcut(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];

  if (shortcut.ctrlKey) parts.push('Ctrl');
  if (shortcut.shiftKey) parts.push('Shift');
  if (shortcut.altKey) parts.push('Alt');
  if (shortcut.metaKey) parts.push('Cmd');

  // Format special keys
  let key = shortcut.key;
  if (key === 'ArrowUp') key = '↑';
  if (key === 'ArrowDown') key = '↓';
  if (key === 'ArrowLeft') key = '←';
  if (key === 'ArrowRight') key = '→';

  parts.push(key.toUpperCase());

  return parts.join(' + ');
}
