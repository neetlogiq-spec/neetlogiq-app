'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from './Layout';
import StreamSelectionModal from '../auth/StreamSelectionModal';

interface LayoutWithStreamSelectionProps {
  children: React.ReactNode;
}

const LayoutWithStreamSelection: React.FC<LayoutWithStreamSelectionProps> = ({ children }) => {
<<<<<<< Updated upstream
  const { showStreamSelection, saveStreamSelection } = useAuth();
=======
  const { showStreamSelection, saveStreamSelection, skipStreamSelection } = useAuth();
  const { showModal, setStream, closeModal, isDeveloper } = useStream();

  // Show modal if EITHER context says to show it (but not for developers)
  const shouldShowModal = !isDeveloper && (!!showStreamSelection || showModal);

  // Handle stream selection completion
  const handleStreamComplete = async (stream: 'UG' | 'PG_MEDICAL' | 'PG_DENTAL') => {
    console.log('✅ Stream selected:', stream);
    try {
      // Save to both contexts
      if (saveStreamSelection) {
        console.log('📝 Saving to AuthContext...');
        await saveStreamSelection(stream);
      }
      console.log('📝 Saving to StreamContext...');
      await setStream(stream);
      console.log('✅ Stream saved successfully');
    } catch (error) {
      console.error('❌ Error saving stream selection:', error);
    }
  };
>>>>>>> Stashed changes

  // Handle modal close (skip stream selection)
  const handleClose = () => {
    console.log('⏭️ Skipping stream selection');
    // Persist the skip decision so it doesn't show again
    if (skipStreamSelection) {
      skipStreamSelection();
    }
    closeModal();
  };

  return (
    <>
      <Layout>
        {children}
      </Layout>
      
<<<<<<< Updated upstream
      <StreamSelectionModal
        isOpen={!!showStreamSelection}
        onClose={() => {}} // Don't allow closing without selection
        onComplete={saveStreamSelection || (() => {})}
      />
=======
      {/* Single consolidated stream selection modal */}
      {shouldShowModal && (
        <StreamSelectionModal
          isOpen={shouldShowModal}
          onClose={handleClose}
          onComplete={handleStreamComplete}
        />
      )}
>>>>>>> Stashed changes
    </>
  );
};

export default LayoutWithStreamSelection;


