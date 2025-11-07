import { useEffect, useRef, useCallback } from 'react';

export interface SessionState {
  activeTab?: string;
  searchQuery?: string;
  selectedItemId?: string;
  scrollPosition?: number;
  filterSettings?: Record<string, any>;
  timestamp?: number;
  [key: string]: any;
}

export interface UseSessionAutoSaveOptions {
  key: string;
  enabled?: boolean;
  saveInterval?: number; // milliseconds
  onSave?: (state: SessionState) => void;
  onRestore?: (state: SessionState) => void;
}

/**
 * Custom hook for auto-saving and restoring session state
 * Automatically persists state to localStorage and restores on mount
 */
export function useSessionAutoSave(
  state: SessionState,
  options: UseSessionAutoSaveOptions
) {
  const {
    key,
    enabled = true,
    saveInterval = 2000, // Auto-save every 2 seconds
    onSave,
    onRestore
  } = options;

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedStateRef = useRef<string>('');

  // Save state to localStorage
  const saveState = useCallback(
    (stateToSave: SessionState) => {
      if (!enabled) return;

      try {
        const stateWithTimestamp = {
          ...stateToSave,
          timestamp: Date.now()
        };

        const serialized = JSON.stringify(stateWithTimestamp);

        // Only save if state has actually changed
        if (serialized !== lastSavedStateRef.current) {
          localStorage.setItem(key, serialized);
          lastSavedStateRef.current = serialized;

          if (onSave) {
            onSave(stateWithTimestamp);
          }

          console.log(`[Session] Auto-saved at ${new Date().toLocaleTimeString()}`);
        }
      } catch (error) {
        console.error('[Session] Failed to save state:', error);
      }
    },
    [key, enabled, onSave]
  );

  // Restore state from localStorage
  const restoreState = useCallback((): SessionState | null => {
    if (!enabled) return null;

    try {
      const serialized = localStorage.getItem(key);
      if (!serialized) return null;

      const restored = JSON.parse(serialized) as SessionState;

      // Check if session is recent (within last 24 hours)
      if (restored.timestamp) {
        const ageHours = (Date.now() - restored.timestamp) / (1000 * 60 * 60);
        if (ageHours > 24) {
          console.log('[Session] Session expired (>24 hours), clearing...');
          clearSession();
          return null;
        }
      }

      if (onRestore) {
        onRestore(restored);
      }

      console.log('[Session] Restored previous session');
      return restored;
    } catch (error) {
      console.error('[Session] Failed to restore state:', error);
      return null;
    }
  }, [key, enabled, onRestore]);

  // Clear saved session
  const clearSession = useCallback(() => {
    try {
      localStorage.removeItem(key);
      lastSavedStateRef.current = '';
      console.log('[Session] Cleared session data');
    } catch (error) {
      console.error('[Session] Failed to clear session:', error);
    }
  }, [key]);

  // Auto-save effect with debouncing
  useEffect(() => {
    if (!enabled) return;

    // Clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Schedule new save
    saveTimeoutRef.current = setTimeout(() => {
      saveState(state);
    }, saveInterval);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [state, saveInterval, enabled, saveState]);

  // Cleanup on unmount - save final state
  useEffect(() => {
    return () => {
      if (enabled) {
        saveState(state);
      }
    };
  }, []);

  return {
    saveState,
    restoreState,
    clearSession
  };
}

/**
 * Hook specifically for staging review session management
 */
export function useStagingReviewSession(initialState: SessionState) {
  const sessionKey = 'staging-review-session';

  const autoSave = useSessionAutoSave(initialState, {
    key: sessionKey,
    enabled: true,
    saveInterval: 2000,
    onSave: (state) => {
      console.log('[Staging Review] Session saved:', {
        tab: state.activeTab,
        hasSearch: !!state.searchQuery,
        selectedItem: state.selectedItemId
      });
    },
    onRestore: (state) => {
      console.log('[Staging Review] Session restored:', {
        tab: state.activeTab,
        age: state.timestamp
          ? `${Math.round((Date.now() - state.timestamp) / 60000)} minutes ago`
          : 'unknown'
      });
    }
  });

  return autoSave;
}

/**
 * Get session metadata without full restoration
 */
export function getSessionMetadata(key: string): {
  exists: boolean;
  timestamp?: number;
  ageMinutes?: number;
} | null {
  try {
    const serialized = localStorage.getItem(key);
    if (!serialized) {
      return { exists: false };
    }

    const data = JSON.parse(serialized);
    const timestamp = data.timestamp;

    if (timestamp) {
      const ageMinutes = Math.round((Date.now() - timestamp) / 60000);
      return {
        exists: true,
        timestamp,
        ageMinutes
      };
    }

    return { exists: true };
  } catch (error) {
    console.error('[Session] Failed to get metadata:', error);
    return null;
  }
}

/**
 * Clear all staging review sessions
 */
export function clearAllStagingReviewSessions() {
  const keys = [
    'staging-review-session',
    'staging-review-filters',
    'staging-review-preferences'
  ];

  keys.forEach(key => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`[Session] Failed to clear ${key}:`, error);
    }
  });

  console.log('[Session] All staging review sessions cleared');
}
