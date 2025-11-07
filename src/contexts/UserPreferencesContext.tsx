'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export interface UserPreferences {
  // UI Preferences
  theme: 'light' | 'dark' | 'system';
  language: 'en' | 'hi' | 'ta' | 'te' | 'bn';
  fontSize: 'small' | 'medium' | 'large';
  density: 'compact' | 'comfortable' | 'spacious';
  
  // Notification Preferences
  notifications: {
    email: boolean;
    push: boolean;
    marketing: boolean;
    updates: boolean;
    reminders: boolean;
  };
  
  // Privacy Preferences
  privacy: {
    profileVisibility: 'public' | 'private' | 'friends';
    dataSharing: boolean;
    analytics: boolean;
    locationTracking: boolean;
  };
  
  // Search & Filter Preferences
  search: {
    saveHistory: boolean;
    autoSuggestions: boolean;
    personalizedResults: boolean;
    defaultFilters: {
      location: string[];
      category: string[];
      type: string[];
    };
  };
  
  // Content Preferences
  content: {
    showImages: boolean;
    autoplayVideos: boolean;
    compressData: boolean;
    showDescriptions: boolean;
    itemsPerPage: 10 | 20 | 50 | 100;
  };
  
  // Accessibility Preferences
  accessibility: {
    highContrast: boolean;
    reduceMotion: boolean;
    screenReader: boolean;
    keyboardNavigation: boolean;
  };
  
  // Dashboard Preferences  
  dashboard: {
    layout: 'grid' | 'list' | 'cards';
    widgets: string[];
    defaultView: 'colleges' | 'courses' | 'cutoffs' | 'overview';
  };
}

interface UserPreferencesContextType {
  preferences: UserPreferences;
  loading: boolean;
  updatePreference: <K extends keyof UserPreferences>(
    key: K,
    value: Partial<UserPreferences[K]>
  ) => Promise<void>;
  resetPreferences: () => Promise<void>;
  exportPreferences: () => string;
  importPreferences: (data: string) => Promise<void>;
}

const defaultPreferences: UserPreferences = {
  theme: 'system',
  language: 'en',
  fontSize: 'medium',
  density: 'comfortable',
  notifications: {
    email: true,
    push: true,
    marketing: false,
    updates: true,
    reminders: true,
  },
  privacy: {
    profileVisibility: 'private',
    dataSharing: false,
    analytics: false,
    locationTracking: false,
  },
  search: {
    saveHistory: true,
    autoSuggestions: true,
    personalizedResults: true,
    defaultFilters: {
      location: [],
      category: [],
      type: [],
    },
  },
  content: {
    showImages: true,
    autoplayVideos: false,
    compressData: false,
    showDescriptions: true,
    itemsPerPage: 20,
  },
  accessibility: {
    highContrast: false,
    reduceMotion: false,
    screenReader: false,
    keyboardNavigation: false,
  },
  dashboard: {
    layout: 'cards',
    widgets: ['overview', 'favorites', 'recent-searches', 'recommendations'],
    defaultView: 'overview',
  },
};

const UserPreferencesContext = createContext<UserPreferencesContextType | undefined>(undefined);

export const useUserPreferences = (): UserPreferencesContextType => {
  const context = useContext(UserPreferencesContext);
  if (context === undefined) {
    throw new Error('useUserPreferences must be used within a UserPreferencesProvider');
  }
  return context;
};

interface UserPreferencesProviderProps {
  children: ReactNode;
}

export const UserPreferencesProvider: React.FC<UserPreferencesProviderProps> = ({ children }) => {
  const { user, isAuthenticated, authToken } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);

  // Load preferences when user authentication changes
  useEffect(() => {
    if (isAuthenticated && user) {
      loadUserPreferences();
    } else {
      loadGuestPreferences();
    }
  }, [isAuthenticated, user]);

  // Apply theme changes to document
  useEffect(() => {
    applyTheme(preferences.theme);
  }, [preferences.theme]);

  // Apply accessibility preferences
  useEffect(() => {
    applyAccessibilityPreferences(preferences.accessibility);
  }, [preferences.accessibility]);

  const loadUserPreferences = async () => {
    try {
      setLoading(true);
      
      // Privacy-first: We only use localStorage, no server storage of user data

      // Fallback to localStorage
      const storedPreferences = localStorage.getItem(`userPreferences_${user?.uid}`);
      if (storedPreferences) {
        const parsed = JSON.parse(storedPreferences);
        setPreferences(mergePreferences(defaultPreferences, parsed));
      } else {
        setPreferences(defaultPreferences);
      }
    } catch (error) {
      console.error('Error loading user preferences:', error);
      setPreferences(defaultPreferences);
    } finally {
      setLoading(false);
    }
  };

  const loadGuestPreferences = () => {
    try {
      setLoading(true);
      const storedPreferences = localStorage.getItem('guestPreferences');
      if (storedPreferences) {
        const parsed = JSON.parse(storedPreferences);
        setPreferences(mergePreferences(defaultPreferences, parsed));
      } else {
        setPreferences(defaultPreferences);
      }
    } catch (error) {
      console.error('Error loading guest preferences:', error);
      setPreferences(defaultPreferences);
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async <K extends keyof UserPreferences>(
    key: K,
    value: Partial<UserPreferences[K]>
  ): Promise<void> => {
    try {
      const newPreferences = {
        ...preferences,
        [key]: {
          ...preferences[key],
          ...value,
        },
      };

      setPreferences(newPreferences);

      // Privacy-first: Always save locally, never to server
      saveToLocalStorage(newPreferences);
    } catch (error) {
      console.error('Error updating preferences:', error);
      // Revert changes on error
      setPreferences(preferences);
      throw error;
    }
  };

  const resetPreferences = async (): Promise<void> => {
    try {
      setPreferences(defaultPreferences);

      // Privacy-first: Only clear localStorage, no server data to reset

      // Clear localStorage
      if (isAuthenticated && user) {
        localStorage.removeItem(`userPreferences_${user.uid}`);
      } else {
        localStorage.removeItem('guestPreferences');
      }
    } catch (error) {
      console.error('Error resetting preferences:', error);
      throw error;
    }
  };

  const exportPreferences = (): string => {
    return JSON.stringify(preferences, null, 2);
  };

  const importPreferences = async (data: string): Promise<void> => {
    try {
      const importedPreferences = JSON.parse(data);
      const validatedPreferences = mergePreferences(defaultPreferences, importedPreferences);
      
      setPreferences(validatedPreferences);

      // Privacy-first: Save imported preferences locally only
      saveToLocalStorage(validatedPreferences);
    } catch (error) {
      console.error('Error importing preferences:', error);
      throw new Error('Invalid preferences data format');
    }
  };

  const saveToLocalStorage = (prefs: UserPreferences) => {
    try {
      const key = isAuthenticated && user ? `userPreferences_${user.uid}` : 'guestPreferences';
      localStorage.setItem(key, JSON.stringify(prefs));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  };

  const mergePreferences = (defaults: UserPreferences, stored: Partial<UserPreferences>): UserPreferences => {
    const merged = { ...defaults };
    
    for (const key in stored) {
      if (key in defaults) {
        const typedKey = key as keyof UserPreferences;
        if (typeof defaults[typedKey] === 'object' && defaults[typedKey] !== null) {
          merged[typedKey] = {
            ...defaults[typedKey] as any,
            ...stored[typedKey] as any,
          };
        } else {
          merged[typedKey] = stored[typedKey] as any;
        }
      }
    }
    
    return merged;
  };

  const applyTheme = (theme: UserPreferences['theme']) => {
    const root = document.documentElement;
    
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      if (mediaQuery.matches) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  };

  const applyAccessibilityPreferences = (accessibility: UserPreferences['accessibility']) => {
    const root = document.documentElement;
    
    // High contrast
    if (accessibility.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }
    
    // Reduced motion
    if (accessibility.reduceMotion) {
      root.classList.add('reduce-motion');
    } else {
      root.classList.remove('reduce-motion');
    }
    
    // Font size
    root.style.fontSize = preferences.fontSize === 'small' ? '14px' : 
                         preferences.fontSize === 'large' ? '18px' : '16px';
  };

  const value: UserPreferencesContextType = {
    preferences,
    loading,
    updatePreference,
    resetPreferences,
    exportPreferences,
    importPreferences,
  };

  return (
    <UserPreferencesContext.Provider value={value}>
      {children}
    </UserPreferencesContext.Provider>
  );
};

export default UserPreferencesContext;