/**
 * DataStore Provider - Ensures data is loaded before rendering app
 */
'use client';

export function DataStoreProvider({ children }: { children: React.ReactNode }) {
  // Always ready - no loading delay
  return <>{children}</>;
}