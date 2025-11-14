'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithGoogle, 
  signOutUser,
  getAuthToken,
  isAdmin as checkIsAdmin
} from '@/lib/firebase';
import { AuthContextType } from '@/types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUserAdmin, setIsUserAdmin] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [showStreamSelection, setShowStreamSelection] = useState(false);

  // Load user data from localStorage on mount
  useEffect(() => {
    const loadUserData = () => {
      try {
        const savedUserData = localStorage.getItem('neetlogiq_user_data');
        if (savedUserData) {
          const userData = JSON.parse(savedUserData);
          if (userData.selectedStream) {
            setUser(prev => prev ? { ...prev, selectedStream: userData.selectedStream } : null);
          }
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };

    loadUserData();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(async (user) => {
      if (user) {
        // Get saved user data from localStorage
        let selectedStream = null;
        try {
          const savedUserData = localStorage.getItem('neetlogiq_user_data');
          if (savedUserData) {
            const userData = JSON.parse(savedUserData);
            selectedStream = userData.selectedStream || null;
          }
        } catch (error) {
          console.error('Error loading user data:', error);
        }

        setUser({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          name: user.displayName || user.email?.split('@')[0] || 'User',
          imageUrl: user.photoURL || undefined,
          givenName: user.displayName?.split(' ')[0] || undefined,
          familyName: user.displayName?.split(' ').slice(1).join(' ') || undefined,
          selectedStream
        } as unknown as User);
        
        // Show stream selection modal if user hasn't selected a stream yet
        // Skip for developer account
        if (!selectedStream && user.email !== 'kashyap0071232000@gmail.com') {
          setShowStreamSelection(true);
        }
        
        // Get auth token
        try {
          const token = await getAuthToken();
          setAuthToken(token);
          
          // Check admin status
          const adminStatus = await checkIsAdmin();
          setIsUserAdmin(adminStatus);
          
          console.log('🔐 Auth Status:', {
            user: user.email,
            isAdmin: adminStatus,
            hasToken: !!token,
            selectedStream
          });
        } catch (error) {
          console.error('Error getting auth token or admin status:', error);
          setAuthToken(null);
          setIsUserAdmin(false);
        }
      } else {
        setUser(null);
        setAuthToken(null);
        setIsUserAdmin(false);
        setShowStreamSelection(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogleHandler = async () => {
    try {
      setLoading(true);
      await signInWithGoogle();
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOutHandler = async () => {
    try {
      setLoading(true);
      await signOutUser();
      // Clear user data from localStorage
      localStorage.removeItem('neetlogiq_user_data');
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get fresh auth token
  const getToken = async (): Promise<string | null> => {
    if (!user) return null;
    try {
      const token = await getAuthToken();
      setAuthToken(token);
      return token;
    } catch (error) {
      console.error('Error refreshing auth token:', error);
      return null;
    }
  };

  // Save user stream selection
  const saveStreamSelection = async (stream: 'UG' | 'PG_MEDICAL' | 'PG_DENTAL') => {
    if (!user) return;
    
    try {
      // Update user state
      setUser(prev => prev ? { ...prev, selectedStream: stream } : null);
      
      // Save to localStorage
      const userData = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        selectedStream: stream
      };
      localStorage.setItem('neetlogiq_user_data', JSON.stringify(userData));
      
      // Hide stream selection modal
      setShowStreamSelection(false);
      
      console.log('✅ Stream selection saved:', stream);
    } catch (error) {
      console.error('Error saving stream selection:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    signInWithGoogle: signInWithGoogleHandler,
    signOut: signOutHandler,
    signOutUser: signOutHandler,
    isAuthenticated: !!user,
    // Extended features
    isAdmin: isUserAdmin,
    authToken,
    getToken,
    // Stream selection
    showStreamSelection,
    saveStreamSelection
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
