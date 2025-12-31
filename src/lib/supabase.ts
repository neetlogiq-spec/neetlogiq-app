/**
 * Supabase Client Configuration
 *
 * This file provides both client-side and server-side Supabase clients.
 * - Client-side: Re-exports from browser.ts (uses @supabase/ssr with cookies)
 * - Server-side: Uses service role key, bypasses RLS (admin access)
 */

import { createClient as createSupabaseJsClient } from '@supabase/supabase-js';
// Import the cookie-based browser client (single source of truth)
import { supabase as browserClient } from '@/lib/supabase/browser';
import type { Database } from './database.types';

<<<<<<< Updated upstream
// Validate environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

// Validate required environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  const missing = [];
  if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!supabaseAnonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  
  const errorMsg = `❌ Missing required Supabase environment variables: ${missing.join(', ')}\n\nPlease add them to your .env.local file:\n${missing.map(v => `${v}=your-value-here`).join('\n')}`;
  
  if (typeof window !== 'undefined') {
    console.error(errorMsg);
  } else {
    // Server-side: throw error to prevent silent failures
    throw new Error(errorMsg);
  }
}

// Client-side Supabase client (safe to use in browser)
// Use a singleton pattern to prevent multiple instances
// Store in global scope to survive hot module reloads
declare global {
  // eslint-disable-next-line no-var
  var __supabaseClient: ReturnType<typeof createClient<Database>> | undefined;
}

function getSupabaseClient() {
  // In browser, check global scope first (survives HMR)
  if (typeof window !== 'undefined' && globalThis.__supabaseClient) {
    return globalThis.__supabaseClient;
  }

  // Create new instance
  const instance = createClient<Database>(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-key',
    {
      auth: {
        persistSession: typeof window !== 'undefined',
        autoRefreshToken: typeof window !== 'undefined',
        detectSessionInUrl: typeof window !== 'undefined',
        storageKey: 'sb-dbkpoiatlynvhrcnpvgw-auth-token'
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    }
  );

  // Store in global scope for browser (survives HMR)
  if (typeof window !== 'undefined') {
    globalThis.__supabaseClient = instance;
  }

  return instance;
}

export const supabase = getSupabaseClient();

// Server-side Supabase client (admin access, bypasses RLS)
// Only use this in API routes, never expose to client!
export const supabaseAdmin = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseServiceKey || supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);
=======
// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const FALLBACK_URL = 'https://xyzxyzxyzxyzxyzxyzxy.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5enh5enh5enh5enh5enh5enh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDk5NzQzODUsImV4cCI6MTk2NTU1MDM4NX0.fakefakefakefakefakefakefakefakefakefake';

// Re-export the browser client - this is the ONLY client for browser use
// This eliminates the "Multiple GoTrueClient instances" warning
export const supabase = browserClient;

// Server-side Supabase client (admin access, bypasses RLS)
// Only use this in API routes, never expose to client!
export const supabaseAdmin = typeof window === 'undefined'
  ? createSupabaseJsClient<Database>(
      supabaseUrl || FALLBACK_URL,
      supabaseServiceKey || FALLBACK_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
  : (null as unknown as ReturnType<typeof createSupabaseJsClient<Database>>);
>>>>>>> Stashed changes

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Get the current authenticated user
 */
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) {
    console.error('Error getting current user:', error);
    return null;
  }

  return user;
}

/**
 * Get user's subscription status
 */
export async function getUserSubscription(userId: string) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('subscription_tier, subscription_end_date')
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('Error getting user subscription:', error);
    return { tier: 'free', endDate: null };
  }

  return {
    tier: data?.subscription_tier || 'free',
    endDate: data?.subscription_end_date
  };
}

/**
 * Check if user has premium access
 */
export async function hasPremiumAccess(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .rpc('has_premium_access', { p_user_id: userId });

    if (error) throw error;
    return data || false;
  } catch (error) {
    console.error('Error checking premium access:', error);
    return false;
  }
}

/**
 * Check if user can get more recommendations today (free tier limit)
 */
export async function canGetRecommendations(userId: string): Promise<boolean> {
  const { tier } = await getUserSubscription(userId);

  // Premium users have unlimited recommendations
  if (tier !== 'free') return true;

  // Check daily limit for free users
  const { data } = await supabase
    .from('user_profiles')
    .select('daily_recommendation_count, last_recommendation_reset')
    .eq('user_id', userId)
    .single();

  if (!data) return false;

  // Reset if last reset was > 24 hours ago
  const lastReset = new Date(data.last_recommendation_reset);
  const now = new Date();
  const hoursSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60);

  if (hoursSinceReset >= 24) {
    // Reset count
    await supabase
      .from('user_profiles')
      .update({
        daily_recommendation_count: 0,
        last_recommendation_reset: now.toISOString()
      })
      .eq('user_id', userId);

    return true;
  }

  // Check if under limit
  return (data.daily_recommendation_count || 0) < 3;
}

/**
 * Increment user's daily recommendation count
 */
export async function incrementRecommendationCount(userId: string) {
  const { data } = await supabase
    .from('user_profiles')
    .select('daily_recommendation_count')
    .eq('user_id', userId)
    .single();

  await supabase
    .from('user_profiles')
    .update({
      daily_recommendation_count: (data?.daily_recommendation_count || 0) + 1
    })
    .eq('user_id', userId);
}

/**
 * Create a notification for user
 */
export async function createNotification(
  userId: string,
  type: 'deadline' | 'seat_alert' | 'cutoff_update' | 'recommendation' | 'system',
  title: string,
  message: string,
  link?: string,
  priority: 'high' | 'medium' | 'low' = 'medium'
) {
  try {
    const { data, error } = await supabase
      .rpc('create_notification', {
        p_user_id: userId,
        p_type: type,
        p_title: title,
        p_message: message,
        p_link: link,
        p_priority: priority
      });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
}

/**
 * Log user activity (for analytics)
 */
export async function logActivity(
  userId: string,
  action: string,
  resourceType?: string,
  resourceId?: string,
  metadata?: any
) {
  try {
    await supabase.from('user_activity').insert({
      user_id: userId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      metadata
    });
  } catch (error) {
    console.error('Error logging activity:', error);
  }
}

// =====================================================
// REAL-TIME SUBSCRIPTIONS
// =====================================================

/**
 * Subscribe to live seat updates for a college
 */
export function subscribeLiveSeatUpdates(
  collegeId: string,
  callback: (payload: any) => void
) {
  const channel = supabase
    .channel(`seats:${collegeId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'live_seat_updates',
        filter: `college_id=eq.${collegeId}`
      },
      callback
    )
    .subscribe();

  return channel;
}

/**
 * Subscribe to user notifications
 */
export function subscribeNotifications(
  userId: string,
  callback: (payload: any) => void
) {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      },
      callback
    )
    .subscribe();

  return channel;
}

// =====================================================
// TYPE EXPORTS
// =====================================================

export type SubscriptionTier = 'free' | 'counseling' | 'premium';
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'pending';

export interface UserProfile {
  user_id: string;
  neet_rank: number | null;
  neet_year: number | null;
  category: string | null;
  state: string | null;
  preferences: any;
  onboarding_completed: boolean;
  subscription_tier: SubscriptionTier;
  subscription_end_date: string | null;
  daily_recommendation_count: number;
  last_recommendation_reset: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan: SubscriptionTier;
  razorpay_subscription_id: string | null;
  razorpay_payment_id: string | null;
  razorpay_order_id: string | null;
  status: SubscriptionStatus;
  start_date: string;
  end_date: string | null;
  auto_renew: boolean;
  amount_paid: number | null;
}

export interface College {
  id: string;
  name: string;
  city: string;
  state: string;
  management_type: 'Government' | 'Private' | 'Trust' | 'Deemed';
  niac_rating: string | null;
  nirf_rank: number | null;
  established_year: number | null;
  facilities: any;
  coordinates: any;
  total_seats: number;
  website_url: string | null;
}

export interface Cutoff {
  id: string;
  college_id: string;
  course_id: string | null;
  year: number;
  category: string;
  quota: string;
  round: number;
  opening_rank: number | null;
  closing_rank: number | null;
  seats: number | null;
}

export interface Recommendation {
  id: string;
  user_id: string;
  college_id: string;
  match_score: number;
  safety_level: 'safe' | 'moderate' | 'reach' | 'dream';
  factors: any;
  reasons: string[];
  is_hidden_gem: boolean;
  is_early_advantage: boolean;
  expires_at: string;
}
