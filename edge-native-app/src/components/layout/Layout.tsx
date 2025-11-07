'use client';

import React from 'react';
import Header from './Header';
import Footer from './Footer';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <Header />
      
      {/* Main content with top padding to account for fixed header */}
      <main className="flex-1 pt-16">
        {children}
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default Layout;
