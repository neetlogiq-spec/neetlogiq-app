'use client';

/**
 * Auth Callback Page
 * 
 * Handles OAuth callbacks from Supabase (Google OAuth).
 * Supports both:
 * - Code exchange (?code=...) - for server-side flows
 * - Hash fragments (#access_token=...) - for client-side flows
 * 
 * The Supabase client is configured with detectSessionInUrl: true,
 * so it will automatically detect and process tokens in the URL.
 */

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Check for error in query params
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');
        
        if (error) {
          console.error('OAuth error:', error, errorDescription);
          setStatus('error');
          setErrorMessage(errorDescription || error);
          setTimeout(() => {
            router.push(`/login?error=${encodeURIComponent(error)}&description=${encodeURIComponent(errorDescription || '')}`);
          }, 2000);
          return;
        }

        // Check for code parameter (for PKCE flow)
        const code = searchParams.get('code');
        if (code) {
          console.log('Exchanging code for session...');
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          
          if (exchangeError) {
            console.error('Error exchanging code:', exchangeError);
            setStatus('error');
            setErrorMessage(exchangeError.message);
            setTimeout(() => {
              router.push(`/login?error=auth_callback_failed&details=${encodeURIComponent(exchangeError.message)}`);
            }, 2000);
            return;
          }

          if (data.session) {
            console.log('✅ Session created successfully');
            setStatus('success');
            setTimeout(() => {
              router.push('/dashboard');
            }, 500);
            return;
          }
        }

        // If we have tokens in the hash, Supabase client will automatically detect them
        // via detectSessionInUrl: true in the client config
        // Check for hash fragments in the URL
        const hash = window.location.hash;
        if (hash && hash.includes('access_token')) {
          console.log('Tokens detected in URL hash, waiting for Supabase to process...');
          
          // Wait for Supabase to process the session from the hash
          // The client is configured with detectSessionInUrl: true
          let attempts = 0;
          const maxAttempts = 10;
          
          const checkSession = setInterval(async () => {
            attempts++;
            const { data: { session }, error } = await supabase.auth.getSession();
            
            if (session) {
              console.log('✅ Session detected from hash');
              clearInterval(checkSession);
              setStatus('success');
              setTimeout(() => {
                router.push('/dashboard');
              }, 500);
            } else if (attempts >= maxAttempts) {
              console.error('Failed to detect session after multiple attempts');
              clearInterval(checkSession);
              setStatus('error');
              setErrorMessage('Failed to process authentication. Please try again.');
              setTimeout(() => {
                router.push('/login?error=auth_callback_failed');
              }, 2000);
            } else if (error) {
              console.error('Error getting session:', error);
              clearInterval(checkSession);
              setStatus('error');
              setErrorMessage(error.message);
              setTimeout(() => {
                router.push(`/login?error=auth_callback_failed&details=${encodeURIComponent(error.message)}`);
              }, 2000);
            }
          }, 300);
          
          return () => clearInterval(checkSession);
        }

        // No code or hash found - redirect to login
        console.warn('No authentication data found in callback URL');
        setStatus('error');
        setErrorMessage('No authentication data found');
        setTimeout(() => {
          router.push('/login?error=auth_callback_failed');
        }, 2000);
      } catch (err: any) {
        console.error('Error in auth callback:', err);
        setStatus('error');
        setErrorMessage(err.message || 'Unknown error');
        setTimeout(() => {
          router.push(`/login?error=auth_callback_failed&details=${encodeURIComponent(err.message || 'Unknown error')}`);
        }, 2000);
      }
    };

    handleCallback();
  }, [router, searchParams]);

  // Show status-based UI
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex flex-col items-center space-y-4 p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        {status === 'processing' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-gray-600 dark:text-gray-300">Completing sign in...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="rounded-full h-12 w-12 bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-gray-600 dark:text-gray-300">Sign in successful! Redirecting...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="rounded-full h-12 w-12 bg-red-100 dark:bg-red-900 flex items-center justify-center">
              <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-red-600 dark:text-red-400">Error: {errorMessage || 'Authentication failed'}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Redirecting to login...</p>
          </>
        )}
      </div>
    </div>
  );
}

