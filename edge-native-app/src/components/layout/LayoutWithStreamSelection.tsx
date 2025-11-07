'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from './Layout';
import StreamSelectionModal from '../auth/StreamSelectionModal';

interface LayoutWithStreamSelectionProps {
  children: React.ReactNode;
}

const LayoutWithStreamSelection: React.FC<LayoutWithStreamSelectionProps> = ({ children }) => {
  const { showStreamSelection, saveStreamSelection } = useAuth();

  return (
    <>
      <Layout>
        {children}
      </Layout>
      
      <StreamSelectionModal
        isOpen={!!showStreamSelection}
        onClose={() => {}} // Don't allow closing without selection
        onComplete={saveStreamSelection || (() => {})}
      />
    </>
  );
};

export default LayoutWithStreamSelection;


