/**
 * Auth Callback Handler
 *
 * Handles OAuth redirects from Supabase (Google OAuth)
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/dashboard';

  if (code) {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Exchange code for session
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Redirect to next URL or dashboard
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
  }

  // If there was an error or no code, redirect to login
  return NextResponse.redirect(new URL('/login?error=auth_callback_failed', requestUrl.origin));
}
