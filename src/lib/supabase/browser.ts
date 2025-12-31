/**
 * Browser-side Supabase Client
 * 
 * Uses @supabase/ssr for cookie-based session storage.
 * This ensures sessions are accessible to both client and server.
 */

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '../database.types'

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null

export function createClient() {
  if (browserClient) {
    return browserClient
  }

  browserClient = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  return browserClient
}

// Export singleton for convenience
export const supabase = createClient()
