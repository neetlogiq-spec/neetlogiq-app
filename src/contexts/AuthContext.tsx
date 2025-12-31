<<<<<<< Updated upstream
/**
 * AuthContext - Supabase Implementation
 *
 * This replaces the Firebase AuthContext with Supabase Auth
 * while maintaining the same interface for backward compatibility
 */

=======
>>>>>>> Stashed changes
'use client';

/**
 * Auth Context
 * 
 * Provides authentication state and methods using Supabase.
 * Uses @supabase/ssr browser client for cookie-based session storage.
 */

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { createClient } from '@/lib/supabase/browser';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';
import type { User } from '@/types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  subscriptionTier: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  showStreamSelection: boolean;
  setShowStreamSelection: (show: boolean) => void;
  isAuthenticated: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscriptionTier, setSubscriptionTier] = useState('free');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [showStreamSelection, setShowStreamSelection] = useState(false);

<<<<<<< Updated upstream
  // Load user profile data from Supabase
  const loadUserProfile = async (userId: string) => {
=======
  const supabase = createClient();

  // Helper to transform Supabase user to App user
  const transformUser = useCallback((supabaseUser: SupabaseUser | null): User | null => {
    if (!supabaseUser) return null;
    
    const meta = supabaseUser.user_metadata || {};
    const fullName = meta.full_name || meta.name || null;
    const photo = meta.avatar_url || meta.picture || null;
    const givenName = meta.given_name || (fullName ? fullName.split(' ')[0] : null);
    
    return {
      uid: supabaseUser.id,
      email: supabaseUser.email || null,
      displayName: fullName,
      photoURL: photo,
      name: fullName,
      givenName: givenName,
      imageUrl: photo,
      user_metadata: meta
    };
  }, []);
 
  // Consolidated admin status check
  const updateAdminStatus = useCallback((email: string | undefined | null, dbRole: string | undefined | null) => {
    if (!email) {
      setIsAdmin(false);
      setIsSuperAdmin(false);
      return;
    }

    const adminEmails = ['kashyap0071232000@gmail.com', 'neetlogiq@gmail.com', 'kashyap2k007@gmail.com'];
    const isDevelperEmail = adminEmails.includes(email.toLowerCase());
    const role = dbRole || 'user';
    
    // Super Admin if role is 'super_admin' OR email is in developer list
    const superAdminStatus = role === 'super_admin' || isDevelperEmail;
    // Admin if role is 'admin' OR they are a Super Admin
    const adminStatus = role === 'admin' || superAdminStatus;

    console.log('🛡️ AuthContext: Calculating status:', { 
      email, 
      dbRole: role, 
      isDevelperEmail,
      finalIsAdmin: adminStatus, 
      finalIsSuperAdmin: superAdminStatus 
    });

    setIsAdmin(adminStatus);
    setIsSuperAdmin(superAdminStatus);
  }, []);

  // Load user profile
  const loadUserProfile = useCallback(async (userId: string, email?: string | null) => {
>>>>>>> Stashed changes
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('subscription_tier, preferences, role')
        .eq('user_id', userId)
        .maybeSingle() as { data: any, error: any };

<<<<<<< Updated upstream
      if (profile) {
        return {
          subscription_tier: profile.subscription_tier,
          subscription_end_date: profile.subscription_end_date,
          selected_stream: profile.preferences?.selectedStream || profile.selected_stream,
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
=======
      if (error) {
        console.error('❌ AuthContext: Error loading profile:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        return;
      }

      if (profile) {
        setSubscriptionTier(profile.subscription_tier || 'free');
        
        // Pass to consolidated check
        updateAdminStatus(email || profile.email, profile.role);
        
        const hasSelectedStream = profile.preferences?.selectedStream;
        const streamSkipped = typeof window !== 'undefined' && 
          localStorage.getItem('streamSelectionSkipped') === 'true';
        
        if (!hasSelectedStream && !streamSkipped) {
          setShowStreamSelection(true);
        }
>>>>>>> Stashed changes
      }
    } catch (error) {
      console.error('Error in loadUserProfile:', error);
    }
<<<<<<< Updated upstream
  };

  // Check admin status (stored in user_metadata or user_profiles)
  const checkAdminStatus = async (user: User): Promise<boolean> => {
    const email = user.email;
    const metadata = user.user_metadata;

    // Check if user is admin (you can customize this logic)
    if (email === 'kashyap0071232000@gmail.com') return true;
    if (metadata?.role === 'admin') return true;
    if (metadata?.is_admin === true) return true;

    // Check user_profiles table for admin role
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('user_id', user.id)
        .single();
      
      if (profile?.role === 'admin' || profile?.role === 'super_admin') {
        return true;
      }
    } catch (error) {
      // Profile might not exist yet
    }

    return false;
  };
=======
  }, [supabase, updateAdminStatus]); // Added updateAdminStatus to dependencies
>>>>>>> Stashed changes

  // Initialize auth
  useEffect(() => {
<<<<<<< Updated upstream
    let mounted = true;
    let subscription: any = null;

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;

      setSession(session);

      if (session?.user) {
        // Ensure user profile exists
        await ensureUserProfile(session.user.id);

        // Load user profile data
        const profileData = await loadUserProfile(session.user.id);

        if (!mounted) return;

        // Create extended user object
        const extendedUser: ExtendedUser = {
          ...session.user,
          ...profileData
        };

        setUser(extendedUser);
        setAuthToken(session.access_token);
        const adminStatus = await checkAdminStatus(session.user);
        setIsUserAdmin(adminStatus);

        // Show stream selection if not completed
        if (!profileData.selected_stream && session.user.email !== 'kashyap0071232000@gmail.com') {
          setShowStreamSelection(true);
        }

        console.log('🔐 Auth Status:', {
          user: session.user.email,
          isAdmin: adminStatus,
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
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        console.log('🔄 Auth state changed:', event);

        setSession(session);

        if (session?.user) {
          // Ensure user profile exists
          await ensureUserProfile(session.user.id);

          // Load user profile data
          const profileData = await loadUserProfile(session.user.id);

          if (!mounted) return;

          // Create extended user object
          const extendedUser: ExtendedUser = {
            ...session.user,
            ...profileData
          };

          setUser(extendedUser);
          setAuthToken(session.access_token);
          const adminStatus = await checkAdminStatus(session.user);
          setIsUserAdmin(adminStatus);

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

    subscription = authSubscription;

    return () => {
      mounted = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);
=======
    const initialize = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (initialSession) {
          setSession(initialSession);
          setUser(transformUser(initialSession.user));
          await loadUserProfile(initialSession.user.id, initialSession.user.email);
          updateAdminStatus(initialSession.user.email, undefined); // Initial check with email
        }
      } catch (error) {
        console.error('Auth init error:', error);
      } finally {
        setLoading(false);
      }
    };

    initialize();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log('🔐 Auth event:', event);
        
        if (newSession) {
          setSession(newSession);
          setUser(transformUser(newSession.user));
          await loadUserProfile(newSession.user.id, newSession.user.email);
          updateAdminStatus(newSession.user.email, undefined); // Initial check with email
        } else {
          setSession(null);
          setUser(null);
          setSubscriptionTier('free');
          updateAdminStatus(undefined, undefined); // Clear admin status
        }
        
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase, loadUserProfile, updateAdminStatus]);
>>>>>>> Stashed changes

  // Sign in with Google
  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      
      const origin = typeof window !== 'undefined' 
        ? window.location.origin 
        : 'http://localhost:3500';
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          }
        }
      });

      if (error) throw error;
    } catch (error) {
      console.error('Sign in error:', error);
      setLoading(false);
      throw error;
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      
      if (error) throw error;
      
      if (typeof window !== 'undefined') {
        localStorage.removeItem('neetlogiq_user_data');
        localStorage.removeItem('streamSelectionSkipped');
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Refresh session
  const refreshSession = async () => {
    try {
      const { data: { session: newSession } } = await supabase.auth.refreshSession();
      if (newSession) {
        setSession(newSession);
        setUser(transformUser(newSession.user));
      }
    } catch (error) {
      console.error('Refresh error:', error);
    }
  };

<<<<<<< Updated upstream
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
    saveStreamSelection
  };

=======
>>>>>>> Stashed changes
  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      subscriptionTier,
      isAdmin,
      isSuperAdmin,
      isAuthenticated: !!user,
      showStreamSelection,
      setShowStreamSelection,
      signInWithGoogle,
      signOut,
      refreshSession,
    }}>
      {children}
    </AuthContext.Provider>
  );
<<<<<<< Updated upstream
};
=======
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
>>>>>>> Stashed changes
