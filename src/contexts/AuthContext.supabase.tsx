/**
 * AuthContext - Supabase Implementation
 *
 * This replaces the Firebase AuthContext with Supabase Auth
 * while maintaining the same interface for backward compatibility
 *
 * To migrate: Rename this file to AuthContext.tsx and delete the old one
 */

'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, getUserSubscription } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import type { AuthContextType } from '@/types';
import type { SubscriptionTier } from '@/lib/subscription-plans';

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

// Extended user type with subscription info
interface ExtendedUser extends User {
  subscription_tier?: SubscriptionTier;
  subscription_end_date?: string | null;
  selected_stream?: 'UG' | 'PG_MEDICAL' | 'PG_DENTAL';
  neet_rank?: number | null;
  neet_year?: number | null;
  category?: string | null;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<ExtendedUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUserAdmin, setIsUserAdmin] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [showStreamSelection, setShowStreamSelection] = useState(false);

  // Load user profile data from Supabase
  const loadUserProfile = async (userId: string) => {
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (profile) {
        return {
          subscription_tier: profile.subscription_tier,
          subscription_end_date: profile.subscription_end_date,
          selected_stream: profile.preferences?.selectedStream,
          neet_rank: profile.neet_rank,
          neet_year: profile.neet_year,
          category: profile.category
        };
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
    return {};
  };

  // Create user profile if it doesn't exist
  const ensureUserProfile = async (userId: string) => {
    try {
      const { data: existing } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('user_id', userId)
        .single();

      if (!existing) {
        await supabase.from('user_profiles').insert({
          user_id: userId,
          subscription_tier: 'free',
          onboarding_completed: false
        });
      }
    } catch (error) {
      console.error('Error ensuring user profile:', error);
    }
  };

  // Check admin status (stored in user_metadata)
  const checkAdminStatus = (user: User): boolean => {
    const email = user.email;
    const metadata = user.user_metadata;

    // Check if user is admin (you can customize this logic)
    if (email === 'kashyap0071232000@gmail.com') return true;
    if (metadata?.role === 'admin') return true;
    if (metadata?.is_admin === true) return true;

    return false;
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);

      if (session?.user) {
        // Ensure user profile exists
        await ensureUserProfile(session.user.id);

        // Load user profile data
        const profileData = await loadUserProfile(session.user.id);

        // Create extended user object
        const extendedUser: ExtendedUser = {
          ...session.user,
          ...profileData
        };

        setUser(extendedUser);
        setAuthToken(session.access_token);
        setIsUserAdmin(checkAdminStatus(session.user));

        // Show stream selection if not completed
        if (!profileData.selected_stream && session.user.email !== 'kashyap0071232000@gmail.com') {
          setShowStreamSelection(true);
        }

        console.log('🔐 Auth Status:', {
          user: session.user.email,
          isAdmin: checkAdminStatus(session.user),
          hasToken: !!session.access_token,
          tier: profileData.subscription_tier,
          selectedStream: profileData.selected_stream
        });
      } else {
        setUser(null);
        setAuthToken(null);
        setIsUserAdmin(false);
      }

      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state changed:', event);

        setSession(session);

        if (session?.user) {
          // Ensure user profile exists
          await ensureUserProfile(session.user.id);

          // Load user profile data
          const profileData = await loadUserProfile(session.user.id);

          // Create extended user object
          const extendedUser: ExtendedUser = {
            ...session.user,
            ...profileData
          };

          setUser(extendedUser);
          setAuthToken(session.access_token);
          setIsUserAdmin(checkAdminStatus(session.user));

          // Show stream selection if not completed
          if (!profileData.selected_stream && session.user.email !== 'kashyap0071232000@gmail.com') {
            setShowStreamSelection(true);
          }
        } else {
          setUser(null);
          setAuthToken(null);
          setIsUserAdmin(false);
          setShowStreamSelection(false);
        }

        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          }
        }
      });

      if (error) throw error;
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
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      // Clear local storage
      localStorage.removeItem('neetlogiq_user_data');
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Get fresh auth token
  const getToken = async (): Promise<string | null> => {
    if (!user) return null;

    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;

      const token = session?.access_token || null;
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
      // Update user profile in Supabase
      const { error } = await supabase
        .from('user_profiles')
        .update({
          preferences: { selectedStream: stream },
          onboarding_completed: true
        })
        .eq('user_id', user.id);

      if (error) throw error;

      // Update local user state
      setUser(prev => prev ? { ...prev, selected_stream: stream } : null);

      // Hide stream selection modal
      setShowStreamSelection(false);

      console.log('✅ Stream selection saved:', stream);
    } catch (error) {
      console.error('Error saving stream selection:', error);
      throw error;
    }
  };

  // Update user profile (NEET rank, category, etc.)
  const updateUserProfile = async (updates: {
    neet_rank?: number;
    neet_year?: number;
    category?: string;
    state?: string;
    preferences?: any;
  }) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('user_id', user.id);

      if (error) throw error;

      // Update local user state
      setUser(prev => prev ? { ...prev, ...updates } : null);

      console.log('✅ User profile updated');
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  };

  // Get user's subscription info
  const getSubscriptionInfo = async () => {
    if (!user) return { tier: 'free', endDate: null };

    const { tier, endDate } = await getUserSubscription(user.id);
    return { tier, endDate };
  };

  // Backward compatibility: Convert Supabase User to Firebase-like User
  const legacyUser = user ? {
    uid: user.id,
    email: user.email,
    displayName: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0],
    photoURL: user.user_metadata?.avatar_url || user.user_metadata?.picture,
    name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User',
    imageUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture,
    givenName: user.user_metadata?.given_name,
    familyName: user.user_metadata?.family_name,
    selectedStream: user.selected_stream
  } : null;

  const value: AuthContextType = {
    user: legacyUser as any,
    loading,
    signInWithGoogle,
    signOut: signOutHandler,
    signOutUser: signOutHandler,
    isAuthenticated: !!user,
    // Extended features
    isAdmin: isUserAdmin,
    authToken,
    getToken,
    // Stream selection
    showStreamSelection,
    saveStreamSelection,
    // New Supabase-specific features
    supabaseUser: user,
    session,
    updateUserProfile,
    getSubscriptionInfo
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Export a hook for subscription info
export const useSubscription = () => {
  const { supabaseUser } = useAuth();

  const [tier, setTier] = useState<SubscriptionTier>('free');
  const [endDate, setEndDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSubscription = async () => {
      if (!supabaseUser) {
        setTier('free');
        setEndDate(null);
        setLoading(false);
        return;
      }

      try {
        const { tier: userTier, endDate: userEndDate } = await getUserSubscription(supabaseUser.id);
        setTier(userTier as SubscriptionTier);
        setEndDate(userEndDate);
      } catch (error) {
        console.error('Error loading subscription:', error);
        setTier('free');
        setEndDate(null);
      } finally {
        setLoading(false);
      }
    };

    loadSubscription();
  }, [supabaseUser]);

  return { tier, endDate, loading, isPremium: tier !== 'free' };
};
