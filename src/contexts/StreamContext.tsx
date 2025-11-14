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
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export type StreamType = 'UG' | 'PG_MEDICAL' | 'PG_DENTAL';

// Developer accounts with unrestricted access
const DEVELOPER_EMAILS = [
  'kashyap0071232000@gmail.com',
  'kashyap2k007@gmail.com',
  'neetlogiq@gmail.com'
];

/**
 * Check if user is a developer account
 */
export function isDeveloperAccount(email: string | null | undefined): boolean {
  if (!email) return false;
  return DEVELOPER_EMAILS.includes(email.toLowerCase());
}

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
  setStream: (stream: StreamType) => Promise<void>;
  clearStream: () => void;
  isStreamSelected: boolean;
  showModal: boolean;
  openModal: () => void;
  closeModal: () => void;
  isDeveloper: boolean; // Developer accounts bypass filtering
  isLocked: boolean; // Whether stream is locked
  lockedAt: string | null; // When stream was locked
  changeRequested: boolean; // Whether user has requested a change
  requestStreamChange: (requestedStream: StreamType, reason: string) => Promise<void>;
  loadingStreamInfo: boolean; // Loading state for stream info
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
  const { user } = useAuth();
  const [selectedStream, setSelectedStream] = useState<StreamType | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lockedAt, setLockedAt] = useState<string | null>(null);
  const [changeRequested, setChangeRequested] = useState(false);
  const [loadingStreamInfo, setLoadingStreamInfo] = useState(false);

  // Check if current user is a developer
  const isDeveloper = isDeveloperAccount(user?.email);

  // Load stream selection from database on mount
  useEffect(() => {
    // Only show modal if user is authenticated
    if (!user) {
      setIsInitialized(true);
      return;
    }

    // Developers bypass stream selection entirely
    if (isDeveloper) {
      setIsInitialized(true);
      return;
    }

    // Load stream from database
    const loadStreamFromDatabase = async () => {
      setLoadingStreamInfo(true);
      try {
        const { data: profile, error } = await supabase
          .from('user_profiles')
          .select('selected_stream, stream_locked, stream_locked_at, stream_change_requested')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = not found
          console.error('Error loading stream from database:', error);
        }

        if (profile?.selected_stream) {
          setSelectedStream(profile.selected_stream as StreamType);
          setIsLocked(profile.stream_locked || false);
          setLockedAt(profile.stream_locked_at || null);
          setChangeRequested(profile.stream_change_requested || false);

          // Sync to localStorage for backwards compatibility
          localStorage.setItem(STORAGE_KEY, profile.selected_stream);
          localStorage.setItem(MODAL_SHOWN_KEY, 'true');
        } else {
          // No stream in database, check localStorage as fallback
          const storedStream = localStorage.getItem(STORAGE_KEY) as StreamType | null;
          if (storedStream && ['UG', 'PG_MEDICAL', 'PG_DENTAL'].includes(storedStream)) {
            setSelectedStream(storedStream);
          } else {
            // Show modal only if no stream selected
            const modalShown = localStorage.getItem(MODAL_SHOWN_KEY);
            if (!modalShown) {
              setShowModal(true);
            }
          }
        }
      } catch (error) {
        console.error('Error in loadStreamFromDatabase:', error);
      } finally {
        setLoadingStreamInfo(false);
        setIsInitialized(true);
      }
    };

    loadStreamFromDatabase();
  }, [isDeveloper, user]);

  const setStream = async (stream: StreamType) => {
    try {
      // If user is authenticated, save to database
      if (user) {
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          const response = await fetch('/api/user/stream', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ stream })
          });

          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to save stream');
          }

          const data = await response.json();

          // Update state from response
          setIsLocked(data.stream.isLocked);
          setLockedAt(data.stream.lockedAt);
        }
      }

      // Update local state
      setSelectedStream(stream);
      localStorage.setItem(STORAGE_KEY, stream);
      localStorage.setItem(MODAL_SHOWN_KEY, 'true');
      setShowModal(false);

      // Clear any cached data that might be stream-specific
      clearStreamCache();
    } catch (error) {
      console.error('Error saving stream:', error);
      // Still update local state even if API fails
      setSelectedStream(stream);
      localStorage.setItem(STORAGE_KEY, stream);
      localStorage.setItem(MODAL_SHOWN_KEY, 'true');
      setShowModal(false);
      clearStreamCache();
      throw error; // Re-throw to let caller handle
    }
  };

  const clearStream = () => {
    setSelectedStream(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(MODAL_SHOWN_KEY);
  };

  const openModal = () => {
    // Only allow opening modal if stream is not locked
    if (!isLocked) {
      setShowModal(true);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    // Mark as shown even if user closes without selecting
    localStorage.setItem(MODAL_SHOWN_KEY, 'true');
  };

  const requestStreamChange = async (requestedStream: StreamType, reason: string) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    if (!isLocked) {
      throw new Error('Stream is not locked. You can change it directly.');
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch('/api/user/stream/request-change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ requestedStream, reason })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to request stream change');
      }

      const data = await response.json();

      // Update local state
      setChangeRequested(true);

      return data;
    } catch (error) {
      console.error('Error requesting stream change:', error);
      throw error;
    }
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
    closeModal,
    isDeveloper,
    isLocked,
    lockedAt,
    changeRequested,
    requestStreamChange,
    loadingStreamInfo
  };

  return (
    <StreamContext.Provider value={value}>
      {children}

      {/* Stream Selection Modal - Hidden for developers */}
      {isInitialized && !isDeveloper && (
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
