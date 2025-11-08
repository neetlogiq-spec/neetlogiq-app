/**
 * Stream Guard Component
 *
 * Ensures user has selected their stream before accessing
 * data pages (colleges, courses, cutoffs, etc.)
 *
 * Shows modal automatically on first visit to non-landing pages.
 */

'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useRequireStream } from '@/contexts/StreamContext';

// Pages that require stream selection
const PAGES_REQUIRING_STREAM = [
  '/colleges',
  '/courses',
  '/cutoffs',
  '/search',
  '/compare',
  '/comparison',
  '/trends',
  '/analytics',
  '/recommendations',
  '/favorites',
  '/dashboard'
];

export default function StreamGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isStreamSelected } = useRequireStream();

  // Check if current page requires stream selection
  const requiresStream = PAGES_REQUIRING_STREAM.some(page =>
    pathname.startsWith(page)
  );

  // Modal will be shown automatically by useRequireStream if needed
  // This component just ensures the hook is called

  return <>{children}</>;
}
