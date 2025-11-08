/**
 * Stream Context
 *
 * Manages user's selected stream (UG, PG_MEDICAL, PG_DENTAL) and provides
 * filtering logic for colleges, courses, and cutoffs.
 *
 * Filtering Rules:
 * - UG: Colleges/Courses (MEDICAL + DENTAL streams), Cutoffs (UG level)
 * - PG_MEDICAL: Colleges/Courses (MEDICAL + DNB streams), Cutoffs (PG_MEDICAL level)
 * - PG_DENTAL: Colleges/Courses (DENTAL stream only), Cutoffs (PG_DENTAL level)
 */

'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import StreamSelectionModal from '@/components/auth/StreamSelectionModal';

export type StreamType = 'UG' | 'PG_MEDICAL' | 'PG_DENTAL';

export interface StreamFilterConfig {
  // For colleges and courses tables
  allowedStreams: string[]; // ['MEDICAL', 'DENTAL', 'DNB']

  // For cutoffs table
  level: string; // 'UG', 'PG_MEDICAL', 'PG_DENTAL'

  // Display info
  displayName: string;
  description: string;
}

// Stream filtering configuration
const STREAM_CONFIGS: Record<StreamType, StreamFilterConfig> = {
  UG: {
    allowedStreams: ['MEDICAL', 'DENTAL'],
    level: 'UG',
    displayName: 'Undergraduate',
    description: 'MBBS & BDS courses'
  },
  PG_MEDICAL: {
    allowedStreams: ['MEDICAL', 'DNB'],
    level: 'PG',
    displayName: 'Postgraduate Medical',
    description: 'MD, MS, DNB courses'
  },
  PG_DENTAL: {
    allowedStreams: ['DENTAL'],
    level: 'PG',
    displayName: 'Postgraduate Dental',
    description: 'MDS courses'
  }
};

interface StreamContextType {
  selectedStream: StreamType | null;
  streamConfig: StreamFilterConfig | null;
  setStream: (stream: StreamType) => void;
  clearStream: () => void;
  isStreamSelected: boolean;
  showModal: boolean;
  openModal: () => void;
  closeModal: () => void;
}

const StreamContext = createContext<StreamContextType | undefined>(undefined);

export const useStream = (): StreamContextType => {
  const context = useContext(StreamContext);
  if (context === undefined) {
    throw new Error('useStream must be used within a StreamProvider');
  }
  return context;
};

interface StreamProviderProps {
  children: ReactNode;
}

const STORAGE_KEY = 'neetlogiq_selected_stream';
const MODAL_SHOWN_KEY = 'neetlogiq_stream_modal_shown';

export const StreamProvider: React.FC<StreamProviderProps> = ({ children }) => {
  const [selectedStream, setSelectedStream] = useState<StreamType | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load stream selection from localStorage on mount
  useEffect(() => {
    const storedStream = localStorage.getItem(STORAGE_KEY) as StreamType | null;
    const modalShown = localStorage.getItem(MODAL_SHOWN_KEY);

    if (storedStream && (storedStream === 'UG' || storedStream === 'PG_MEDICAL' || storedStream === 'PG_DENTAL')) {
      setSelectedStream(storedStream);
      setIsInitialized(true);
    } else {
      // Show modal only if not shown before and on a non-landing page
      // We'll check the route in the component that uses this context
      if (!modalShown) {
        setShowModal(true);
      }
      setIsInitialized(true);
    }
  }, []);

  const setStream = (stream: StreamType) => {
    setSelectedStream(stream);
    localStorage.setItem(STORAGE_KEY, stream);
    localStorage.setItem(MODAL_SHOWN_KEY, 'true');
    setShowModal(false);

    // Clear any cached data that might be stream-specific
    clearStreamCache();
  };

  const clearStream = () => {
    setSelectedStream(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(MODAL_SHOWN_KEY);
  };

  const openModal = () => {
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    // Mark as shown even if user closes without selecting
    localStorage.setItem(MODAL_SHOWN_KEY, 'true');
  };

  const clearStreamCache = () => {
    // Clear any stream-specific cached data from localStorage
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.startsWith('cutoffs:') ||
        key.startsWith('colleges:') ||
        key.startsWith('courses:')
      )) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
  };

  const streamConfig = selectedStream ? STREAM_CONFIGS[selectedStream] : null;

  const value: StreamContextType = {
    selectedStream,
    streamConfig,
    setStream,
    clearStream,
    isStreamSelected: selectedStream !== null,
    showModal,
    openModal,
    closeModal
  };

  return (
    <StreamContext.Provider value={value}>
      {children}

      {/* Stream Selection Modal */}
      {isInitialized && (
        <StreamSelectionModal
          isOpen={showModal}
          onClose={closeModal}
          onComplete={setStream}
        />
      )}
    </StreamContext.Provider>
  );
};

/**
 * Helper function to check if a college/course should be shown based on stream
 */
export function shouldShowForStream(
  itemStream: string,
  selectedStream: StreamType | null
): boolean {
  if (!selectedStream) return true; // Show all if no stream selected

  const config = STREAM_CONFIGS[selectedStream];
  return config.allowedStreams.includes(itemStream.toUpperCase());
}

/**
 * Helper function to get SQL WHERE clause for filtering colleges/courses
 */
export function getStreamWhereClause(selectedStream: StreamType | null): string {
  if (!selectedStream) return '1=1'; // No filter

  const config = STREAM_CONFIGS[selectedStream];
  const streams = config.allowedStreams.map(s => `'${s}'`).join(', ');
  return `stream IN (${streams})`;
}

/**
 * Helper function to get SQL WHERE clause for filtering cutoffs by level
 */
export function getLevelWhereClause(selectedStream: StreamType | null): string {
  if (!selectedStream) return '1=1'; // No filter

  const config = STREAM_CONFIGS[selectedStream];
  return `level = '${config.level}'`;
}

/**
 * React Hook to check if stream is selected and show modal if not
 */
export function useRequireStream() {
  const { isStreamSelected, openModal } = useStream();

  useEffect(() => {
    // Only trigger on pages other than landing page
    const isLandingPage = window.location.pathname === '/';

    if (!isLandingPage && !isStreamSelected) {
      // Small delay to avoid showing modal too early
      const timer = setTimeout(() => {
        openModal();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [isStreamSelected, openModal]);

  return { isStreamSelected };
}

export default StreamContext;
