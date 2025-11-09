'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { LoginModal } from './LoginModal';

interface AuthGuardProps {
  children: React.ReactNode;
}

// Pages that don't require authentication
const PUBLIC_PATHS = [
  '/',  // Landing page
  '/about',
];

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Check if current path is public
  const isPublicPath = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    // Wait for auth to initialize
    if (loading) return;

    setIsInitialized(true);

    // If on a protected page and not authenticated, show login modal
    if (!isPublicPath && !user) {
      setShowLoginModal(true);
    } else {
      setShowLoginModal(false);
    }
  }, [user, loading, pathname, isPublicPath]);

  // Show loading state while checking auth
  if (loading || !isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login modal if on protected page and not authenticated
  if (!isPublicPath && !user) {
    return (
      <>
        {/* Show a minimal version of the page in background */}
        <div className="opacity-50 pointer-events-none">
          {children}
        </div>

        {/* Login modal */}
        <LoginModal
          isOpen={showLoginModal}
          onClose={() => {
            setShowLoginModal(false);
            // Redirect to landing page if they close the modal
            router.push('/');
          }}
          onSuccess={() => {
            setShowLoginModal(false);
            // User is now authenticated, StreamContext will handle stream selection
          }}
        />
      </>
    );
  }

  // User is authenticated or on public page
  return <>{children}</>;
};
