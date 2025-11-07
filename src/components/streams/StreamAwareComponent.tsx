'use client';

import React, { ReactNode } from 'react';
import { useStreamDataService, StreamType } from '@/services/StreamDataService';
import { useAuth } from '@/contexts/AuthContext';

interface StreamAwareComponentProps {
  children: (props: {
    currentStream: StreamType | null;
    streamConfig: any;
    isStreamSelected: boolean;
    showStreamSelection: boolean;
  }) => ReactNode;
  fallback?: ReactNode;
  requireStream?: boolean;
}

const StreamAwareComponent: React.FC<StreamAwareComponentProps> = ({
  children,
  fallback = null,
  requireStream = false
}) => {
  const { user } = useAuth();
  const { currentStream, streamConfig } = useStreamDataService();
  
  const isStreamSelected = !!currentStream;
  const showStreamSelection = !isStreamSelected && requireStream;

  // If stream is required but not selected, show fallback or stream selection
  if (requireStream && !isStreamSelected) {
    return <>{fallback}</>;
  }

  return (
    <>
      {children({
        currentStream,
        streamConfig,
        isStreamSelected,
        showStreamSelection
      })}
    </>
  );
};

export default StreamAwareComponent;
