'use client';

import React from 'react';
import Header from './Header';
import Footer from './Footer';
import MobileBottomNavigation from '@/components/mobile/MobileBottomNavigation';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <Header />

      {/* Main content with top padding to account for fixed header and bottom padding for mobile nav */}
      <main className="flex-1 pt-16 pb-20 md:pb-0">
        {children}
      </main>

      {/* Footer */}
      <Footer />

      {/* Mobile Bottom Navigation */}
      <MobileBottomNavigation />
    </div>
  );
};

export default Layout;
