'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthModal from '@/components/auth/AuthModal';
import { useAuth } from '@/contexts/AuthContext';

const SignupPage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(true);
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  const handleClose = () => {
    setIsModalOpen(false);
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <AuthModal 
        isOpen={isModalOpen}
        onClose={handleClose}
        initialMode="signup"
      />
    </div>
  );
};

export default SignupPage;