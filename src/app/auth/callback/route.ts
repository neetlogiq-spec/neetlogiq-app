/**
 * Auth Callback Route Handler
 * 
 * Handles OAuth callback from Supabase/Google.
 * Exchanges the authorization code for a session and sets cookies.
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin
  const next = requestUrl.searchParams.get('next') || '/dashboard'

  console.log('🔐 Auth Callback:', { 
    hasCode: !!code, 
    origin, 
    next 
  })

  if (code) {
    const supabase = await createClient()
    
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error('❌ Code exchange error:', error.message)
      // Redirect to error page or home
      return NextResponse.redirect(`${origin}/?error=auth_error`)
    }
    
    console.log('✅ Session established via code exchange')
  }

  // Redirect to the next page (usually dashboard)
  return NextResponse.redirect(`${origin}${next}`)
}
